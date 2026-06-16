<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Support\SwaggerFixtures;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Requests\UpsertBannerRequest;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Advertising', weight: 70)]
class AdminBannerController extends Controller
{
    public function index(): JsonResponse
    {
        $items = Banner::query()->latest()->paginate(20);

        return response()->json(['data' => $items]);
    }

    #[Endpoint(title: 'Создать баннер')]
    #[BodyParameter('placement', example: SwaggerFixtures::BANNER_PLACEMENT)]
    #[BodyParameter('title', example: 'Новый баннер Swagger')]
    #[BodyParameter('link_url', example: 'https://dev.modelizmclub.ru')]
    #[BodyParameter('text', example: 'Текст баннера')]
    #[BodyParameter('is_active', example: true)]
    public function store(UpsertBannerRequest $request, AuditService $audit): JsonResponse
    {
        $banner = Banner::query()->create($request->validated());
        $audit->log($request->user(), 'admin.banners.create', $banner, null, $banner->toArray(), $request);

        return response()->json(['data' => $banner], 201);
    }

    #[PathParameter('id', description: 'ID баннера после seed', example: 1)]
    public function show(int $id): JsonResponse
    {
        $banner = Banner::query()->find($id);

        if (! $banner) {
            throw new NotFoundHttpException('Баннер не найден.');
        }

        return response()->json(['data' => $banner]);
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
        $banner->update($request->validated());
        $audit->log($request->user(), 'admin.banners.update', $banner, $old, $banner->fresh()->toArray(), $request);

        return response()->json(['data' => $banner->fresh()]);
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
}
