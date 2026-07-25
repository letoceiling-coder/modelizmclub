<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Support\BannerCarouselConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BannersController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $carousel = BannerCarouselConfig::get();
        $placement = $request->string('placement')->toString() ?: $carousel['placement'];

        $banners = Banner::query()
            ->with('image')
            ->where('is_active', true)
            ->where('placement', $placement)
            ->where(function ($q): void {
                $q->where('force_visible', true)
                    ->orWhere(function ($q2): void {
                        $q2->where(function ($q3): void {
                            $q3->whereNull('starts_at')->orWhere('starts_at', '<=', now());
                        })->where(function ($q3): void {
                            $q3->whereNull('ends_at')->orWhere('ends_at', '>=', now());
                        });
                    });
            })
            ->orderByDesc('is_pinned')
            ->orderByDesc('priority')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->limit($carousel['max_slides'])
            ->get()
            ->map(fn (Banner $b) => $this->toPublicArray($b));

        return response()->json([
            'data' => $banners,
            'meta' => [
                'carousel' => $carousel,
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function toPublicArray(Banner $b): array
    {
        return [
            'id' => $b->id,
            'placement' => $b->placement,
            'title' => $b->title,
            'text' => $b->text,
            'cta_text' => $b->cta_text,
            'kind' => $b->kind,
            'until_label' => $b->until_label,
            'link_url' => $b->link_url,
            'image_url' => $b->image?->url,
            'is_pinned' => (bool) $b->is_pinned,
            'priority' => (int) $b->priority,
            'is_active' => (bool) $b->is_active,
        ];
    }
}
