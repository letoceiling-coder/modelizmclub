<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Requests\StoreCommentRequest;
use Modules\Feed\Http\Resources\CommentResource;
use Modules\Feed\Services\CommentService;
use Modules\Feed\Services\PostService;

class PostCommentsController extends Controller
{
    public function index(string $uuid, Request $request, PostService $posts, CommentService $comments): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $data = $request->validate([
            'sort' => ['sometimes', 'nullable', 'string', 'in:interesting,old,new'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        return CommentResource::collection(
            $comments->listForPost(
                $post,
                (int) ($data['per_page'] ?? 20),
                (string) ($data['sort'] ?? 'interesting'),
            ),
        )->response();
    }

    public function store(string $uuid, StoreCommentRequest $request, PostService $posts, CommentService $comments): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $this->authorize('comment', $post);
        $comment = $comments->createOnPost(
            $post,
            $request->user(),
            (string) $request->input('body', ''),
            $request->input('parent_uuid'),
            $request->input('media_ids', []) ?? [],
        );

        return (new CommentResource($comment))
            ->response()
            ->setStatusCode(201);
    }
}
