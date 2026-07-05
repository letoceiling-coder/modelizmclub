<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;

class UnpinMessageController extends Controller
{
    public function __invoke(string $uuid, string $messageUuid, Request $request, ChatService $chat): JsonResponse
    {
        $conversation = $chat->findConversation($uuid, $request->user());

        $chat->unpinMessage($conversation, $request->user());

        return response()->json(['pinned' => false]);
    }
}
