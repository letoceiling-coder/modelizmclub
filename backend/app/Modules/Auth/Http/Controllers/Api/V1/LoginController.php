<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Auth\Http\Requests\LoginRequest;
use Modules\Auth\Http\Resources\UserResource;
use Modules\Auth\Services\AuthService;

class LoginController extends Controller
{
    public function __invoke(LoginRequest $request, AuthService $auth): JsonResponse
    {
        $result = $auth->login(
            email: $request->string('email')->toString(),
            password: $request->string('password')->toString(),
        );

        return response()->json([
            'data' => new UserResource($result['user']),
            'meta' => [
                'token' => $result['token'],
                'token_type' => 'Bearer',
            ],
        ]);
    }
}
