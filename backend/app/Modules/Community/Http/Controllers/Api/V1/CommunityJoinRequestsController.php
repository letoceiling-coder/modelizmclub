<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommunityJoinRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Services\CommunityHubService;
use Modules\Community\Services\CommunityService;
use Modules\User\Http\Resources\UserCompactResource;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CommunityJoinRequestsController extends Controller
{
    public function index(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        if (! $community->canManage($request->user())) {
            throw new AccessDeniedHttpException('Заявки доступны только администраторам.');
        }

        $rows = CommunityJoinRequest::query()
            ->where('community_id', $community->id)
            ->where('status', CommunityJoinRequest::STATUS_PENDING)
            ->with(['user.profile.avatar'])
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (CommunityJoinRequest $row) => [
                'id' => $row->id,
                'message' => $row->message,
                'created_at' => $row->created_at?->toIso8601String(),
                'user' => new UserCompactResource($row->user),
            ]),
        ]);
    }

    public function approve(string $slug, int $id, Request $request, CommunityService $communities, CommunityHubService $hub): JsonResponse
    {
        [$community, $row] = $this->pending($slug, $id, $request, $communities);
        $hub->approveJoinRequest($community, $row, $request->user());

        return response()->json(['message' => 'Заявка одобрена.']);
    }

    public function reject(string $slug, int $id, Request $request, CommunityService $communities, CommunityHubService $hub): JsonResponse
    {
        [$community, $row] = $this->pending($slug, $id, $request, $communities);
        $hub->rejectJoinRequest($community, $row, $request->user());

        return response()->json(['message' => 'Заявка отклонена.']);
    }

    public function ban(string $slug, string $userUuid, Request $request, CommunityService $communities, CommunityHubService $hub): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        if (! $community->canManage($request->user())) {
            throw new AccessDeniedHttpException('Исключать участников может администратор.');
        }

        $target = User::query()->where('uuid', $userUuid)->first();
        if (! $target) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        $hub->banMember($community, $request->user(), $target);

        return response()->json(['message' => 'Участник исключён.']);
    }

    /** @return array{0: \App\Models\Community, 1: CommunityJoinRequest} */
    private function pending(string $slug, int $id, Request $request, CommunityService $communities): array
    {
        $community = $communities->findActiveBySlug($slug);
        if (! $community->canManage($request->user())) {
            throw new AccessDeniedHttpException('Заявки доступны только администраторам.');
        }

        $row = CommunityJoinRequest::query()
            ->where('community_id', $community->id)
            ->whereKey($id)
            ->where('status', CommunityJoinRequest::STATUS_PENDING)
            ->first();
        if (! $row) {
            throw new NotFoundHttpException('Заявка не найдена.');
        }

        return [$community, $row];
    }
}
