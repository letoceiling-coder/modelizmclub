<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Video\Http\Resources\VideoResource;
use Modules\Video\Services\VideoService;

class CancelScheduledVideoController extends Controller
{
    public function __invoke(string $uuid, Request $request, VideoService $videos): JsonResponse
    {
        $video = $videos->adminShow($uuid);
        $video = $videos->cancelSchedule($video, $request->user());

        return (new VideoResource($video))->response();
    }
}
