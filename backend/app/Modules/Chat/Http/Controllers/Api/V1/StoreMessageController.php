<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Http\Resources\MessageResource;
use Modules\Chat\Services\ChatService;

class StoreMessageController extends Controller
{
    public function __invoke(string $uuid, Request $request, ChatService $chat): JsonResponse
    {
        $data = $request->validate([
            'body' => ['nullable', 'required_without_all:media_uuids,forwarded_from_message_uuid,post_uuid', 'string', 'max:10000'],
            'reply_to_uuid' => ['nullable', 'string', 'uuid'],
            'forwarded_from_message_uuid' => ['nullable', 'string', 'uuid'],
            'post_uuid' => ['nullable', 'string', 'uuid', 'exists:posts,uuid'],
            'type' => ['nullable', 'string', 'in:text,voice,image,file,post'],
            'media_uuids' => ['nullable', 'array', 'max:10'],
            'media_uuids.*' => ['string', 'uuid'],
        ]);

        $post = ! empty($data['post_uuid'])
            ? Post::query()->where('uuid', $data['post_uuid'])->firstOrFail()
            : null;

        $conversation = $chat->findConversation($uuid, $request->user());
        $chat->attachMessageStatusContext($request, $conversation, $request->user());
        $message = $chat->sendMessage(
            $conversation,
            $request->user(),
            $data['body'] ?? null,
            $data['reply_to_uuid'] ?? null,
            $data['type'] ?? 'text',
            $data['media_uuids'] ?? [],
            $data['forwarded_from_message_uuid'] ?? null,
            $post,
        );

        return response()->json([
            'data' => new MessageResource($message),
        ], 201);
    }
}
