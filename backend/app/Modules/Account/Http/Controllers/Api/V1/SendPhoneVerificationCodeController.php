<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Account\Http\Requests\SendPhoneVerificationRequest;
use Modules\Auth\Services\PhoneVerificationService;

class SendPhoneVerificationCodeController extends Controller
{
    public function __invoke(
        SendPhoneVerificationRequest $request,
        PhoneVerificationService $phones,
    ): JsonResponse {
        $phones->sendCode(
            $request->user(),
            $request->string('phone')->toString(),
            $request,
        );

        $ttl = (int) config('sms.verification.ttl_minutes', 10);

        return response()->json([
            'data' => [
                'message' => 'Код отправлен по SMS.',
                'expires_in_minutes' => $ttl,
                // Сколько ждать до следующей отправки. Клиент считает отсчёт
                // по этому числу, а не по своей копии значения: пауза задаётся
                // переменной окружения и разъехалась бы при первой же правке.
                'resend_after' => (int) config('sms.verification.resend_cooldown_seconds', 60),
                /*
                 * Сколько цифр в отправленном коде — решение З1 от 09.10.
                 *
                 * Форма строит поле по этому числу и по нему же пишет «Код
                 * из N цифр». Своей копии шестёрки у интерфейса больше нет:
                 * до 09.10 их было три (`maxLength={6}`, `slice(0, 6)`,
                 * `length !== 6`) в двух файлах, и смена настройки на сервере
                 * означала форму, которая не принимает собственный код.
                 */
                'code_length' => PhoneVerificationService::codeLength(),
                // Сколько раз можно ошибиться до «запросите новый».
                'max_attempts' => (int) config('sms.verification.max_verify_attempts', 5),
            ],
        ], 202);
    }
}
