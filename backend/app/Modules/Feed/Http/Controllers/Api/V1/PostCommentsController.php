<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\CommentResource;
use Modules\Feed\Services\CommentService;
use Modules\Feed\Services\PostService;

class PostCommentsController extends Controller
{
    public function index(string $uuid, Request $request, PostService $posts, CommentService $comments): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());

        return CommentResource::collection(
            $comments->listForPost($post, $request->integer('per_page', 20)),
        )->response();
    }

    public function store(string $uuid, Request $request, PostService $posts, CommentService $comments): JsonResponse
    {
        $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'parent_uuid' => ['nullable', 'uuid', 'exists:comments,uuid'],
        ]);

        $post = $posts->findByUuid($uuid, $request->user());
        $comment = $comments->createOnPost(
            $post,
            $request->user(),
            $request->string('body')->toString(),
            $request->string('parent_uuid')->toString() ?: null,
        );

        return (new CommentResource($comment))
            ->response()
            ->setStatusCode(201);
    }
}
