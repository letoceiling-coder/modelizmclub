<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;

class DestroyConversationController extends Controller
{
    public function __invoke(string $uuid, Request $request, ChatService $chat): JsonResponse
    {
        $this->authorize('delete', Conversation::query()->where('uuid', $uuid)->firstOrFail());
        $chat->leaveConversation($request->user(), $uuid);

        return response()->json(['message' => 'ok']);
    }
}
