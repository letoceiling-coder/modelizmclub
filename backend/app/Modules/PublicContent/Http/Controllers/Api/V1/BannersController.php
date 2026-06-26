<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\FaqCategory;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BannersController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $placement = $request->string('placement')->toString() ?: 'feed';

        $banners = Banner::query()
            ->where('is_active', true)
            ->where('placement', $placement)
            ->where(function ($q): void {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            })
            ->orderBy('id')
            ->get()
            ->map(fn (Banner $b) => [
                'id' => $b->id,
                'placement' => $b->placement,
                'title' => $b->title,
                'text' => $b->text,
                'link_url' => $b->link_url,
            ]);

        return response()->json(['data' => $banners]);
    }
}
