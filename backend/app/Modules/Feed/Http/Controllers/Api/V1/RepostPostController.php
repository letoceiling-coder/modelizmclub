<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Feed\Http\Requests\StoreRepostRequest;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostInteractionService;
use Modules\Feed\Services\PostService;

class RepostPostController extends Controller
{
    public function __invoke(string $uuid, StoreRepostRequest $request, PostService $posts, PostInteractionService $interactions): JsonResponse
    {
        $original = $posts->findByUuid($uuid, $request->user());
        $repost = $interactions->repost($original, $request->user(), $request->input('body'));

        $repost->load($posts->defaultRelations());
        $posts->attachViewerFlags($repost, $request->user());

        return (new PostResource($repost))
            ->response()
            ->setStatusCode(201);
    }
}
