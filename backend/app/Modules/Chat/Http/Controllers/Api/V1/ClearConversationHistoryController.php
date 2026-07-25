<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;

class ClearConversationHistoryController extends Controller
{
    public function __invoke(string $uuid, Request $request, ChatService $chat): JsonResponse
    {
        $conversation = $chat->findConversation($uuid, $request->user());
        $chat->clearHistoryForUser($conversation, $request->user());

        return response()->json(['message' => 'ok']);
    }
}
