<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostService;

class PublishPostController extends Controller
{
    public function __invoke(string $uuid, Request $request, PostService $posts): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $post = $posts->publish($post, $request->user());

        return (new PostResource($post))->response();
    }
}
