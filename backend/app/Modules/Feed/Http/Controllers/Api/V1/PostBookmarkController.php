<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Services\PostInteractionService;
use Modules\Feed\Services\PostService;

class PostBookmarkController extends Controller
{
    public function store(string $uuid, Request $request, PostService $posts, PostInteractionService $interactions): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $interactions->bookmark($post, $request->user());

        return response()->json(['message' => 'Добавлено в закладки.']);
    }

    public function destroy(string $uuid, Request $request, PostService $posts, PostInteractionService $interactions): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $interactions->removeBookmark($post, $request->user());

        return response()->json(['message' => 'Удалено из закладок.']);
    }
}
