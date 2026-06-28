<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FriendRequest;
use App\Models\User;
use App\Notifications\InAppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Http\Resources\FriendRequestResource;
use Modules\User\Http\Resources\UserCompactResource;
use Modules\User\Services\FriendService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class FriendController extends Controller
{
    public function indexFriends(Request $request, FriendService $friends): JsonResponse
    {
        $paginator = $friends->listFriends($request->user(), (int) $request->integer('per_page', 20));

        return UserCompactResource::collection($paginator)->response();
    }

    public function indexIncomingRequests(Request $request, FriendService $friends): JsonResponse
    {
        $items = $friends->listIncomingPending($request->user());

        return response()->json([
            'data' => FriendRequestResource::collection($items),
        ]);
    }

    public function storeRequest(int $id, Request $request, FriendService $friends): JsonResponse
    {
        $target = $this->findUser($id);
        $friendRequest = $friends->sendRequest($request->user(), $target);
        $friendRequest->load(['fromUser.profile.avatar', 'toUser.profile.avatar']);

        if ($friendRequest->wasRecentlyCreated) {
            $name = $request->user()->profile?->display_name ?? $request->user()->name ?? 'Пользователь';
            $target->notify(new InAppNotification(
                type: 'friend_request',
                title: $name.' отправил заявку в друзья',
                link: '/friends',
            ));
        }

        return (new FriendRequestResource($friendRequest))
            ->response()
            ->setStatusCode($friendRequest->wasRecentlyCreated ? 201 : 200);
    }

    public function accept(int $requestId, Request $request, FriendService $friends): JsonResponse
    {
        $friendRequest = $this->findRequest($requestId);
        $updated = $friends->acceptRequest($request->user(), $friendRequest);

        $requester = $updated->fromUser ?? $friendRequest->fromUser;
        if ($requester) {
            $name = $request->user()->profile?->display_name ?? $request->user()->name ?? 'Пользователь';
            $requester->notify(new InAppNotification(
                type: 'friend_accept',
                title: $name.' принял вашу заявку в друзья',
                link: '/friends',
            ));
        }

        return response()->json([
            'data' => new FriendRequestResource($updated),
            'message' => 'Заявка принята.',
        ]);
    }

    public function decline(int $requestId, Request $request, FriendService $friends): JsonResponse
    {
        $friendRequest = $this->findRequest($requestId);
        $updated = $friends->declineRequest($request->user(), $friendRequest);

        return response()->json([
            'data' => new FriendRequestResource($updated),
            'message' => 'Заявка отклонена.',
        ]);
    }

    public function cancel(int $requestId, Request $request, FriendService $friends): JsonResponse
    {
        $friendRequest = $this->findRequest($requestId);
        $updated = $friends->cancelRequest($request->user(), $friendRequest);

        return response()->json([
            'data' => new FriendRequestResource($updated),
            'message' => 'Заявка отменена.',
        ]);
    }

    public function destroyFriend(int $id, Request $request, FriendService $friends): JsonResponse
    {
        $target = $this->findUser($id);
        $friends->removeFriend($request->user(), $target);

        return response()->json(['message' => 'Удалён из друзей.']);
    }

    private function findUser(int $id): User
    {
        $user = User::query()->whereKey($id)->first();

        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        return $user;
    }

    private function findRequest(int $id): FriendRequest
    {
        $friendRequest = FriendRequest::query()->find($id);

        if (! $friendRequest) {
            throw new NotFoundHttpException('Заявка не найдена.');
        }

        return $friendRequest;
    }
}
