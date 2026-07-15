<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Video\Http\Resources\VideoResource;
use Modules\Video\Services\VideoService;

class StoreVideoController extends Controller
{
    public function __invoke(Request $request, VideoService $videos): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'string'],
            'tags' => ['nullable', 'array'],
            'poster_media_id' => ['nullable', 'string'],
            'video_media_id' => ['required', 'string'],
            'is_featured' => ['nullable', 'boolean'],
        ]);

        $video = $videos->create($request->user(), $data);

        return response()->json(['data' => new VideoResource($video->load(['category', 'poster', 'videoMedia', 'uploader']))], 201);
    }
}
