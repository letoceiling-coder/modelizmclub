<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Feed\Http\Resources\CommentResource;
use Modules\Feed\Services\CommentService;

class CommentThreadController extends Controller
{
    public function __invoke(string $uuid, CommentService $comments): JsonResponse
    {
        $thread = $comments->thread($uuid);

        return response()->json([
            'data' => CommentResource::collection($thread),
        ]);
    }
}
