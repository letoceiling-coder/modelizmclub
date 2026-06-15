<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Feed\Http\Requests\StorePostRequest;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostService;

class StorePostController extends Controller
{
    public function __invoke(StorePostRequest $request, PostService $posts): JsonResponse
    {
        $post = $posts->create($request->user(), $request->validated());

        return (new PostResource($post))
            ->response()
            ->setStatusCode(201);
    }
}
