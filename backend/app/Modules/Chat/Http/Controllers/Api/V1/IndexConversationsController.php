<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Http\Resources\ConversationResource;
use Modules\Chat\Services\ChatService;

class IndexConversationsController extends Controller
{
    public function __invoke(Request $request, ChatService $chat): JsonResponse
    {
        $paginator = $chat->listConversations(
            $request->user(),
            $request->integer('per_page', 30),
            $request->string('space')->toString() === 'communities' ? 'communities' : 'chats',
        );

        return ConversationResource::collection($paginator)->response();
    }
}
