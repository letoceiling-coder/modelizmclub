<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;

class UnpinConversationController extends Controller
{
    public function __invoke(string $uuid, Request $request, ChatService $chat): JsonResponse
    {
        $this->authorize('pin', Conversation::query()->where('uuid', $uuid)->firstOrFail());
        $conversation = $chat->findConversation($uuid, $request->user());
        $chat->unpinConversation($conversation, $request->user());

        return response()->json(['pinned' => false]);
    }
}
