<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostInteractionService;
use Modules\Feed\Services\PostService;

class PostReactionController extends Controller
{
    public function store(string $uuid, Request $request, PostService $posts, PostInteractionService $interactions): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $post = $interactions->react($post, $request->user(), $request->string('type', 'like')->toString());

        return (new PostResource($post->load($posts->defaultRelations())))->response();
    }

    public function destroy(string $uuid, Request $request, PostService $posts, PostInteractionService $interactions): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $post = $interactions->removeReaction($post, $request->user());

        return (new PostResource($post->load($posts->defaultRelations())))->response();
    }
}
