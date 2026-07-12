<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Video\Services\VideoService;

class VideoViewController extends Controller
{
    public function __invoke(string $uuid, Request $request, VideoService $videos): JsonResponse
    {
        $video = Video::query()->where('uuid', $uuid)->where('status', 'published')->firstOrFail();
        $videos->recordView($video, $request->user());

        return response()->json(['data' => ['views_count' => $video->fresh()->views_count]]);
    }
}
