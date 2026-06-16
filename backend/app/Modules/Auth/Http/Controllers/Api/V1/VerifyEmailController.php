<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Auth\Http\Requests\VerifyEmailRequest;
use Modules\Auth\Http\Resources\UserResource;
use Modules\Auth\Services\AuthService;

#[Group('Auth', weight: 0)]
class VerifyEmailController extends Controller
{
    #[Endpoint(title: 'Подтверждение email', description: 'Проверяет код из письма после регистрации. Возвращает Bearer-токен в `meta.token`.')]
    #[BodyParameter('email', description: 'Email из регистрации', example: 'newuser@example.com')]
    #[BodyParameter('code', description: '6-значный код из письма', example: '123456')]
    public function __invoke(VerifyEmailRequest $request, AuthService $auth): JsonResponse
    {
        $result = $auth->verifyEmail(
            email: $request->string('email')->toString(),
            code: $request->string('code')->toString(),
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
