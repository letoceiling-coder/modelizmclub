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
            'body' => ['nullable', 'required_without_all:media_uuids,forwarded_from_message_uuid', 'string', 'max:10000'],
            'reply_to_uuid' => ['nullable', 'string', 'uuid'],
            'forwarded_from_message_uuid' => ['nullable', 'string', 'uuid'],
            'type' => ['nullable', 'string', 'in:text,voice,image,file'],
            'media_uuids' => ['nullable', 'array', 'max:10'],
            'media_uuids.*' => ['string', 'uuid'],
        ]);

        $conversation = $chat->findConversation($uuid, $request->user());
        $message = $chat->sendMessage(
            $conversation,
            $request->user(),
            $data['body'] ?? null,
            $data['reply_to_uuid'] ?? null,
            $data['type'] ?? 'text',
            $data['media_uuids'] ?? [],
            $data['forwarded_from_message_uuid'] ?? null,
        );

        return response()->json([
            'data' => new MessageResource($message),
        ], 201);
    }
}
