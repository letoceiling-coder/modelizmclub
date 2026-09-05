<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Services\CommunityEngagementService;
use Modules\Community\Services\CommunityService;
use Modules\User\Http\Resources\UserCompactResource;

class CommunityInviteController extends Controller
{
    /** Кого ещё можно позвать: друзья, которых нет в сообществе. */
    public function index(
        string $slug,
        Request $request,
        CommunityService $communities,
        CommunityEngagementService $engagement,
    ): JsonResponse {
        $community = $communities->findActiveBySlug($slug);
        $this->authorize('invite', $community);

        return response()->json([
            'data' => UserCompactResource::collection(
                $engagement->invitableFriends($request->user(), $community),
            ),
        ]);
    }

    public function store(
        string $slug,
        Request $request,
        CommunityService $communities,
        CommunityEngagementService $engagement,
    ): JsonResponse {
        $community = $communities->findActiveBySlug($slug);
        $this->authorize('invite', $community);

        $data = $request->validate([
            'user_uuids' => ['required', 'array', 'min:1', 'max:'.CommunityEngagementService::INVITE_MAX],
            'user_uuids.*' => ['required', 'uuid'],
        ]);

        $sent = $engagement->invite($request->user(), $community, $data['user_uuids']);

        return response()->json([
            'data' => ['sent' => $sent],
            'message' => $sent > 0 ? 'Приглашения отправлены.' : 'Никого не пригласили.',
        ]);
    }
}
