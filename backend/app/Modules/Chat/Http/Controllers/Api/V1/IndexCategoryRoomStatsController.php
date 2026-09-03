<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;

class IndexCategoryRoomStatsController extends Controller
{
    public function __invoke(Request $request, ChatService $chat, ?int $parentId = null): JsonResponse
    {
        return response()->json([
            'data' => $chat->postCategoryRoomStats($parentId, $request->user()),
        ]);
    }
}
