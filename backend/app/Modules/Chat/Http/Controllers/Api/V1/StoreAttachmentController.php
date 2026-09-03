<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;
use Modules\Media\Services\MediaUploadService;

class StoreAttachmentController extends Controller
{
    public function __invoke(string $uuid, Request $request, ChatService $chat): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:'.MediaUploadService::maxSizeKb('chat')],
        ]);

        $this->authorize('send', Conversation::query()->where('uuid', $uuid)->firstOrFail());

        $conversation = $chat->findConversation($uuid, $request->user());
        $attachment = $chat->uploadAttachment($conversation, $request->user(), $validated['file']);

        return response()->json($attachment, 201);
    }
}
