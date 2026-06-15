<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Feed\Http\Requests\UpdatePostRequest;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostService;

class UpdatePostController extends Controller
{
    public function __invoke(string $uuid, UpdatePostRequest $request, PostService $posts): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $post = $posts->update($post, $request->user(), $request->validated());

        return (new PostResource($post))->response();
    }
}
