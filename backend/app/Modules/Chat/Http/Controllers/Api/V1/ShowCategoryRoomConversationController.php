<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;

class ShowCategoryRoomConversationController extends Controller
{
    public function __invoke(int $parentId, int $subId, Request $request, ChatService $chat): JsonResponse
    {
        $conversation = $chat->findOrCreateCategoryRoom($parentId, $subId, $request->user());

        return response()->json([
            'data' => [
                'conversation_uuid' => $conversation->uuid,
                'title' => $conversation->title,
            ],
        ]);
    }
}
