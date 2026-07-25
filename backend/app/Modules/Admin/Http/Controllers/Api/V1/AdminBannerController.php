<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\Media;
use App\Support\BannerCarouselConfig;
use App\Support\SwaggerFixtures;
use Carbon\Carbon;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Http\Requests\UpsertBannerRequest;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Advertising', weight: 70)]
class AdminBannerController extends Controller
{
    public function index(): JsonResponse
    {
        $items = Banner::query()
            ->with('image')
            ->orderByDesc('is_pinned')
            ->orderByDesc('priority')
            ->orderBy('sort_order')
            ->latest('id')
            ->paginate(50);

        return response()->json([
            'data' => $items->through(fn (Banner $b) => $this->toAdminArray($b)),
            'meta' => [
                'carousel' => BannerCarouselConfig::get(),
            ],
        ]);
    }

    #[Endpoint(title: 'Создать баннер')]
    #[BodyParameter('placement', example: SwaggerFixtures::BANNER_PLACEMENT)]
    #[BodyParameter('title', example: 'Новый баннер Swagger')]
    #[BodyParameter('link_url', example: 'https://dev.modelizmclub.ru')]
    #[BodyParameter('text', example: 'Текст баннера')]
    #[BodyParameter('is_active', example: true)]
    public function store(UpsertBannerRequest $request, AuditService $audit): JsonResponse
    {
        $banner = Banner::query()->create($this->payloadFromRequest($request));
        $audit->log($request->user(), 'admin.banners.create', $banner, null, $banner->toArray(), $request);

        return response()->json(['data' => $this->toAdminArray($banner->load('image'))], 201);
    }

    #[PathParameter('id', description: 'ID баннера после seed', example: 1)]
    public function show(int $id): JsonResponse
    {
        $banner = Banner::query()->with('image')->find($id);

        if (! $banner) {
            throw new NotFoundHttpException('Баннер не найден.');
        }

        return response()->json(['data' => $this->toAdminArray($banner)]);
    }

    #[PathParameter('id', example: 1)]
    #[BodyParameter('title', example: 'Swagger demo banner (updated)')]
    public function update(UpsertBannerRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $banner = Banner::query()->find($id);

        if (! $banner) {
            throw new NotFoundHttpException('Баннер не найден.');
        }

        $old = $banner->toArray();
        $banner->update($this->payloadFromRequest($request));
        $audit->log($request->user(), 'admin.banners.update', $banner, $old, $banner->fresh()->toArray(), $request);

        return response()->json(['data' => $this->toAdminArray($banner->fresh()->load('image'))]);
    }

    #[PathParameter('id', description: 'ID созданного баннера для DELETE', example: 2)]
    public function destroy(int $id, AuditService $audit): JsonResponse
    {
        $banner = Banner::query()->find($id);

        if (! $banner) {
            throw new NotFoundHttpException('Баннер не найден.');
        }

        $banner->delete();
        $audit->log(request()->user(), 'admin.banners.delete', $banner, $banner->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Баннер удалён.']]);
    }

    public function updateCarousel(Request $request, AuditService $audit): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'placement' => ['sometimes', 'string', 'max:32'],
            'autoplay_seconds' => ['sometimes', 'integer', 'min:3', 'max:120'],
            'max_slides' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        $old = BannerCarouselConfig::get();
        $next = BannerCarouselConfig::save($validated);
        $audit->log($request->user(), 'admin.banners.carousel', null, $old, $next, $request);

        return response()->json(['data' => $next]);
    }

    /** @return array<string, mixed> */
    private function toAdminArray(Banner $b): array
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
            'image_media_id' => $b->image_media_id,
            'image_url' => $b->image?->url,
            'starts_at' => $b->starts_at?->toIso8601String(),
            'ends_at' => $b->ends_at?->toIso8601String(),
            'is_active' => (bool) $b->is_active,
            'force_visible' => (bool) $b->force_visible,
            'is_pinned' => (bool) $b->is_pinned,
            'priority' => (int) $b->priority,
            'sort_order' => (int) $b->sort_order,
            'impressions_count' => (int) $b->impressions_count,
            'clicks_count' => (int) $b->clicks_count,
        ];
    }

    /** @return array<string, mixed> */
    private function payloadFromRequest(UpsertBannerRequest $request): array
    {
        $data = $request->validated();

        if ($request->filled('image_media_uuid')) {
            $media = Media::query()->where('uuid', $request->string('image_media_uuid')->toString())->first();
            if ($media) {
                $data['image_media_id'] = $media->id;
            }
        }

        unset($data['image_media_uuid']);

        if (array_key_exists('starts_at', $data)) {
            $data['starts_at'] = filled($data['starts_at'])
                ? Carbon::parse($data['starts_at'])->startOfDay()
                : null;
        }

        if (array_key_exists('ends_at', $data)) {
            $data['ends_at'] = filled($data['ends_at'])
                ? Carbon::parse($data['ends_at'])->endOfDay()
                : null;
        }

        return $data;
    }
}
