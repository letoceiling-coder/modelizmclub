<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Services\ChatService;
use Modules\User\Http\Resources\UserCompactResource;

class IndexCategoryRoomMembersController extends Controller
{
    public function __invoke(int $parentId, int $subId, Request $request, ChatService $chat): JsonResponse
    {
        $result = $chat->listCategoryRoomMembers($parentId, $subId, $request->user());

        return response()->json([
            'data' => [
                'members' => $result['members']->map(fn ($p) => [
                    'user' => new UserCompactResource($p->user),
                    'role' => $p->role,
                ])->values(),
                'online_count' => $result['online_count'],
                'total' => $result['total'],
            ],
        ]);
    }
}
