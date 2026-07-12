<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\CommentResource;
use Modules\Video\Services\VideoService;

class StoreVideoCommentController extends Controller
{
    public function __invoke(string $uuid, Request $request, VideoService $videos): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'parent_uuid' => ['nullable', 'uuid', 'exists:comments,uuid'],
        ]);

        $video = Video::query()->where('uuid', $uuid)->where('status', 'published')->firstOrFail();
        $comment = $videos->addComment($video, $request->user(), $data['body'], $data['parent_uuid'] ?? null);

        return (new CommentResource($comment))->response()->setStatusCode(201);
    }
}
