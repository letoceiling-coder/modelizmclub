<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Services\CommentService;

class DestroyCommentController extends Controller
{
    public function __invoke(string $uuid, Request $request, CommentService $comments): JsonResponse
    {
        $comment = $comments->findByUuid($uuid);
        $this->authorize('delete', $comment);
        $comments->delete($comment, $request->user());

        return response()->json(['message' => 'Комментарий удалён.']);
    }
}
