<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Services\PostService;

class DestroyPostController extends Controller
{
    public function __invoke(string $uuid, Request $request, PostService $posts): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());
        $posts->delete($post, $request->user());

        return response()->json(['message' => 'Публикация удалена.']);
    }
}
