<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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

    public function update(Request $request, string $uuid, VideoService $videos): JsonResponse
    {
        $video = $videos->adminShow($uuid);

        $data = $request->validate([
            'status' => ['nullable', Rule::in(['processing', 'published', 'rejected', 'scheduled'])],
            'is_featured' => ['nullable', 'boolean'],
        ]);

        $video = $videos->adminUpdate($video, $data);

        return (new VideoResource($video))->response();
    }

    public function destroy(string $uuid, Request $request, VideoService $videos): JsonResponse
    {
        $video = $videos->adminShow($uuid);
        $videos->delete($video, $request->user());

        return response()->json(['message' => 'Обзор удалён.']);
    }
}
