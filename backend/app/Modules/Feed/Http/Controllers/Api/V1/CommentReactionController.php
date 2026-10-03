<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Enums\ReactionType;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Feed\Services\CommentService;

class CommentReactionController extends Controller
{
    public function store(Request $request, string $uuid, CommentService $comments): JsonResponse
    {
        $data = $request->validate([
            'type' => ['sometimes', 'string', Rule::in(ReactionType::forContent())],
        ]);
        $type = $data['type'] ?? ReactionType::Like->value;
        $comment = $comments->findByUuid($uuid);
        $this->authorize('react', $comment);
        $comment = $comments->react($comment, $request->user(), $type);

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
        $comment = $comments->findByUuid($uuid);
        $this->authorize('react', $comment);
        $comment = $comments->removeReaction($comment, $request->user());

        return response()->json([
            'data' => [
                'uuid' => $comment->uuid,
                'reactions_count' => $comment->reactions_count,
                'viewer_reacted' => false,
            ],
        ]);
    }
}
