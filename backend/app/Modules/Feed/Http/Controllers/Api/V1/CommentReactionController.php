<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Services\CommentService;

class CommentReactionController extends Controller
{
    public function store(Request $request, string $uuid, CommentService $comments): JsonResponse
    {
        $type = $request->string('type')->toString() ?: 'like';
        $comment = $comments->react($comments->findByUuid($uuid), $request->user(), $type);

        return response()->json([
            'data' => [
                'uuid' => $comment->uuid,
                'reactions_count' => $comment->reactions_count,
                'viewer_reacted' => true,
            ],
        ]);
    }

    public function destroy(Request $request, string $uuid, CommentService $comments): JsonResponse
    {
        $comment = $comments->removeReaction($comments->findByUuid($uuid), $request->user());

        return response()->json([
            'data' => [
                'uuid' => $comment->uuid,
                'reactions_count' => $comment->reactions_count,
                'viewer_reacted' => false,
            ],
        ]);
    }
}
