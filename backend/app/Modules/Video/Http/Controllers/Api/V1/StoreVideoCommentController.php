<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Modules\Feed\Http\Requests\StoreCommentRequest;
use Modules\Feed\Http\Resources\CommentResource;
use Modules\Video\Services\VideoService;

class StoreVideoCommentController extends Controller
{
    public function __invoke(string $uuid, StoreCommentRequest $request, VideoService $videos): JsonResponse
    {
        $video = Video::query()->where('uuid', $uuid)->where('status', 'published')->firstOrFail();
        $comment = $videos->addComment(
            $video,
            $request->user(),
            (string) $request->input('body', ''),
            $request->input('parent_uuid'),
            $request->input('media_ids', []) ?? [],
        );

        return (new CommentResource($comment))->response()->setStatusCode(201);
    }
}
