<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;

class StoreAttachmentController extends Controller
{
    public function __invoke(string $uuid, Request $request, ChatService $chat): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:25600'],
        ]);

        $conversation = $chat->findConversation($uuid, $request->user());
        $attachment = $chat->uploadAttachment($conversation, $request->user(), $validated['file']);

        return response()->json($attachment, 201);
    }
}
