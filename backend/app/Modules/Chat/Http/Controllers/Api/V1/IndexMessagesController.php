<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Http\Resources\MessageResource;
use Modules\Chat\Services\ChatService;

class IndexMessagesController extends Controller
{
    public function __invoke(string $uuid, Request $request, ChatService $chat): JsonResponse
    {
        $paginator = $chat->listMessages(
            $uuid,
            $request->user(),
            $request->integer('per_page', 50),
        );

        return MessageResource::collection($paginator)->response();
    }
}
