<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\CommentResource;
use Modules\Video\Services\VideoService;

class VideoReactionController extends Controller
{
    public function store(string $uuid, Request $request, VideoService $videos): JsonResponse
    {
        $video = Video::query()->where('uuid', $uuid)->firstOrFail();
        $videos->react($video, $request->user());

        return response()->json(['message' => 'ok']);
    }

    public function destroy(string $uuid, Request $request, VideoService $videos): JsonResponse
    {
        $video = Video::query()->where('uuid', $uuid)->firstOrFail();
        $videos->unreact($video, $request->user());

        return response()->json(['message' => 'ok']);
    }
}
