<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostInteractionService;
use Modules\Feed\Services\PostService;

class RepostPostController extends Controller
{
    public function __invoke(string $uuid, Request $request, PostService $posts, PostInteractionService $interactions): JsonResponse
    {
        $original = $posts->findByUuid($uuid, $request->user());
        $repost = $interactions->repost($original, $request->user());

        return (new PostResource($repost->load($posts->defaultRelations())))
            ->response()
            ->setStatusCode(201);
    }
}
