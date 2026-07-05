<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Http\Resources\ConversationResource;
use Modules\Chat\Services\ChatService;

class ShowConversationController extends Controller
{
    public function __invoke(string $uuid, Request $request, ChatService $chat): JsonResponse
    {
        $conversation = $chat->showConversation($uuid, $request->user());

        return response()->json([
            'data' => new ConversationResource($conversation),
        ]);
    }
}
