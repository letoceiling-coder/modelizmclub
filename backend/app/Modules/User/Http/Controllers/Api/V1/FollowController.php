<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Services\UserService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class FollowController extends Controller
{
    public function store(int $id, Request $request, UserService $users): JsonResponse
    {
        $target = $this->findTargetUser($id);

        $users->follow($request->user(), $target);

        return response()->json(['message' => 'Подписка оформлена.']);
    }

    public function destroy(int $id, Request $request, UserService $users): JsonResponse
    {
        $target = $this->findTargetUser($id);

        $users->unfollow($request->user(), $target);

        return response()->json(['message' => 'Подписка отменена.']);
    }

    private function findTargetUser(int $id): User
    {
        $user = User::query()->whereKey($id)->first();

        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        return $user;
    }
}
