<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use Dedoc\Scramble\Attributes\Group;
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

    public function store(UpsertBannerRequest $request, AuditService $audit): JsonResponse
    {
        $banner = Banner::query()->create($request->validated());
        $audit->log($request->user(), 'admin.banners.create', $banner, null, $banner->toArray(), $request);

        return response()->json(['data' => $banner], 201);
    }

    public function show(int $id): JsonResponse
    {
        $banner = Banner::query()->find($id);

        if (! $banner) {
            throw new NotFoundHttpException('Баннер не найден.');
        }

        return response()->json(['data' => $banner]);
    }

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
