<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\CommentResource;
use Modules\Video\Services\VideoService;

class VideoCommentsController extends Controller
{
    public function __invoke(string $uuid, Request $request, VideoService $videos): JsonResponse
    {
        $video = Video::query()->where('uuid', $uuid)->where('status', 'published')->firstOrFail();

        return CommentResource::collection(
            $videos->listComments($video, $request->integer('per_page', 50)),
        )->response();
    }
}
