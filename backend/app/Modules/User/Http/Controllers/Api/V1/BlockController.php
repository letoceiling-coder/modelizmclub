<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Http\Requests\BlockUserRequest;
use Modules\User\Http\Resources\UserCompactResource;
use Modules\User\Services\UserService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class BlockController extends Controller
{
    public function store(int $id, BlockUserRequest $request, UserService $users): JsonResponse
    {
        $target = $this->findTargetUser($id);

        $users->block($request->user(), $target, $request->validated('reason'));

        return response()->json(['message' => 'Пользователь заблокирован.']);
    }

    public function index(Request $request, UserService $users): JsonResponse
    {
        return response()->json([
            'data' => UserCompactResource::collection(
                $users->listBlocks($request->user()),
            ),
        ]);
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
