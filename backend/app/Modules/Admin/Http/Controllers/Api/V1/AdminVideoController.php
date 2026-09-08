<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Admin\Http\Requests\AdminUpdateVideoRequest;
use Modules\Admin\Services\AuditService;
use Modules\Video\Http\Resources\VideoResource;
use Modules\Video\Services\VideoService;

class AdminVideoController extends Controller
{
    public function index(Request $request, VideoService $videos): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['processing', 'published', 'rejected', 'scheduled'])],
            'q' => ['nullable', 'string', 'max:200'],
        ]);

        $items = $videos->adminList($filters, (int) $request->integer('per_page', 50));

        return VideoResource::collection($items)->response();
    }

    public function show(string $uuid, VideoService $videos): JsonResponse
    {
        $video = $videos->adminShow($uuid);

        return (new VideoResource($video))->response();
    }

    public function update(AdminUpdateVideoRequest $request, string $uuid, VideoService $videos, AuditService $audit): JsonResponse
    {
        $video = $videos->adminShow($uuid);
        $old = $video->only(['title', 'status', 'category_id']);
        $video = $videos->adminUpdate($video, $request->validated(), $request->user());

        $audit->log($request->user(), 'admin.videos.update', $video, $old, $video->fresh()->only(['title', 'status', 'category_id']), $request);

        return (new VideoResource($video))->response();
    }

    public function destroy(string $uuid, Request $request, VideoService $videos, AuditService $audit): JsonResponse
    {
        $video = $videos->adminShow($uuid);
        $old = $video->only(['uuid', 'title', 'status']);
        $videos->delete($video, $request->user());

        $audit->log($request->user(), 'admin.videos.delete', null, $old, null, $request);

        return response()->json(['message' => 'Обзор удалён.']);
    }
}
