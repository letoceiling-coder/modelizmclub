<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Http\Resources\MessageResource;
use Modules\Chat\Services\ChatService;

class StoreMessageController extends Controller
{
    public function __invoke(string $uuid, Request $request, ChatService $chat): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
            'reply_to_uuid' => ['nullable', 'string', 'uuid'],
        ]);

        $conversation = $chat->findConversation($uuid, $request->user());
        $message = $chat->sendMessage(
            $conversation,
            $request->user(),
            $data['body'],
            $data['reply_to_uuid'] ?? null,
        );

        return response()->json([
            'data' => new MessageResource($message),
        ], 201);
    }
}
