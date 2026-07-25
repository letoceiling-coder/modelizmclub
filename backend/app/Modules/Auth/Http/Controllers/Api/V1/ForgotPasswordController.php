<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Modules\Auth\Http\Requests\ForgotPasswordRequest;

class ForgotPasswordController extends Controller
{
    public function __invoke(ForgotPasswordRequest $request): JsonResponse
    {
        $email = $request->string('email')->toString();
        $account = \App\Models\User::query()->whereRaw('lower(email) = ?', [Str::lower(trim($email))])->first();

        if ($account) {
            Password::sendResetLink(['email' => $account->email]);
        }

        return response()->json([
            'data' => [
                'message' => 'Если аккаунт существует, ссылка для сброса пароля отправлена на email.',
            ],
        ]);
    }
}
