<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostService;

class ShowPostController extends Controller
{
    public function __invoke(string $uuid, Request $request, PostService $posts): JsonResponse
    {
        $viewer = $request->user('sanctum');
        $post = $posts->findByUuid($uuid, $viewer);
        $posts->recordView($post, $viewer);

        return (new PostResource($post))->response();
    }
}
