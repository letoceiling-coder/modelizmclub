<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Auth\Http\Requests\ResetPasswordRequest;
use Modules\Auth\Http\Resources\UserResource;
use Modules\Auth\Services\AuthService;

#[Group('Auth', weight: 0)]
class ResetPasswordController extends Controller
{
    #[Endpoint(title: 'Сброс пароля', description: 'Устанавливает новый пароль по токену из письма и сразу возвращает Bearer-токен в `meta.token`.')]
    #[BodyParameter('email', description: 'Email аккаунта', example: 'user@example.com')]
    #[BodyParameter('token', description: 'Токен из ссылки в письме', example: 'abc123')]
    #[BodyParameter('password', description: 'Новый пароль (от 8 символов)', example: 'newpassword123')]
    #[BodyParameter('password_confirmation', description: 'Повтор нового пароля', example: 'newpassword123')]
    public function __invoke(ResetPasswordRequest $request, AuthService $auth): JsonResponse
    {
        $result = $auth->resetPassword(
            email: $request->string('email')->toString(),
            token: $request->string('token')->toString(),
            password: $request->string('password')->toString(),
            passwordConfirmation: $request->string('password_confirmation')->toString(),
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
