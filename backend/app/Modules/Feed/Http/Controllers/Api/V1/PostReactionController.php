<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Enums\ReactionType;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostInteractionService;
use Modules\Feed\Services\PostService;

class PostReactionController extends Controller
{
    public function store(string $uuid, Request $request, PostService $posts, PostInteractionService $interactions): JsonResponse
    {
        $data = $request->validate([
            'type' => ['sometimes', 'string', Rule::in(ReactionType::forContent())],
        ]);

        $post = $posts->findByUuid($uuid, $request->user());
        $post = $interactions->react($post, $request->user(), $data['type'] ?? ReactionType::Like->value);

        return (new PostResource($post->load($posts->defaultRelations())))->response();
    }

    public function destroy(string $uuid, Request $request, PostService $posts, PostInteractionService $interactions): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $post = $interactions->removeReaction($post, $request->user());

        return (new PostResource($post->load($posts->defaultRelations())))->response();
    }
}
