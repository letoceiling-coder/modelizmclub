<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;

class PinMessageController extends Controller
{
    public function __invoke(string $uuid, string $messageUuid, Request $request, ChatService $chat): JsonResponse
    {
        $conversation = $chat->findConversation($uuid, $request->user());
        $message = $chat->findMessageInConversation($conversation, $messageUuid);

        $chat->pinMessage($conversation, $message, $request->user());

        return response()->json(['pinned' => true]);
    }
}
