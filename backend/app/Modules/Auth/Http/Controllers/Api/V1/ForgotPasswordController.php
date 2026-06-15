<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;
use Modules\Auth\Http\Requests\ForgotPasswordRequest;

class ForgotPasswordController extends Controller
{
    public function __invoke(ForgotPasswordRequest $request): JsonResponse
    {
        Password::sendResetLink(['email' => $request->string('email')->toString()]);

        return response()->json([
            'data' => [
                'message' => 'Если аккаунт существует, ссылка для сброса пароля отправлена на email.',
            ],
        ]);
    }
}
