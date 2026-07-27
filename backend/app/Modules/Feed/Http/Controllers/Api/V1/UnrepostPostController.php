<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostInteractionService;
use Modules\Feed\Services\PostService;

class UnrepostPostController extends Controller
{
    public function __invoke(string $uuid, Request $request, PostService $posts, PostInteractionService $interactions): JsonResponse
    {
        $original = $posts->findByUuid($uuid, $request->user());
        $interactions->unrepost($original, $request->user());

        $original->load($posts->defaultRelations());
        $posts->attachViewerFlags($original, $request->user());

        return (new PostResource($original))->response();
    }
}
