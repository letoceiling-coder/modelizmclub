<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Enums\RegistrationTrack;
use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Auth\Http\Requests\RegisterRequest;
use Modules\Auth\Services\AuthService;

#[Group('Auth', weight: 0)]
class RegisterController extends Controller
{
    #[Endpoint(
        operationId: 'v1.register',
        title: 'Регистрация',
        description: 'Создаёт аккаунт и отправляет код подтверждения на email. После успешной регистрации вызовите `POST /v1/auth/verify-email`.',
    )]
    #[BodyParameter('email', description: 'Email пользователя', example: 'newuser@example.com')]
    #[BodyParameter('password', description: 'Пароль (минимум 8 символов)', example: 'password123')]
    #[BodyParameter('password_confirmation', description: 'Повтор пароля', example: 'password123')]
    #[BodyParameter('registration_track', description: 'Трек регистрации: `community` — лента и сообщества; `listing` — объявления', example: 'community')]
    #[BodyParameter('display_name', description: 'Отображаемое имя (необязательно)', required: false, example: 'Иван Моделист')]
    #[BodyParameter('referral_code', description: 'Реферальный код пригласившего (необязательно)', required: false, example: 'MDLZM-ABC123')]
    public function __invoke(RegisterRequest $request, AuthService $auth): JsonResponse
    {
        $auth->register(
            email: $request->string('email')->toString(),
            password: $request->string('password')->toString(),
            track: RegistrationTrack::from($request->string('registration_track')->toString()),
            displayName: $request->filled('display_name') ? $request->string('display_name')->toString() : null,
            referralCode: $request->filled('referral_code') ? $request->string('referral_code')->toString() : null,
        );

        return response()->json([
            'data' => [
                'message' => 'Код подтверждения отправлен на email.',
            ],
        ], 201);
    }
}
