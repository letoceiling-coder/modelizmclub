<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;

class DeleteMessageForEveryoneController extends Controller
{
    public function __invoke(string $uuid, string $messageUuid, Request $request, ChatService $chat): JsonResponse
    {
        $this->authorize('view', Conversation::query()->where('uuid', $uuid)->firstOrFail());
        $conversation = $chat->findConversation($uuid, $request->user());
        $message = $chat->findMessageInConversation($conversation, $messageUuid);
        $this->authorize('delete', $message);

        $chat->deleteMessageForEveryone($conversation, $message, $request->user());

        return response()->json(['message' => 'ok']);
    }
}
