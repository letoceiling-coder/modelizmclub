<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Auth\Http\Requests\LoginRequest;
use Modules\Auth\Http\Resources\UserResource;
use Modules\Auth\Services\AuthService;

#[Group('Auth', weight: 0)]
class LoginController extends Controller
{
    #[Endpoint(title: 'Вход', description: 'Возвращает Bearer-токен Sanctum в `meta.token`.')]
    #[BodyParameter('email', description: 'Email', example: 'demo@modelizmclub.ru')]
    #[BodyParameter('password', description: 'Пароль', example: 'password123')]
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
