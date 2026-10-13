<?php

namespace Modules\Auth\Services;

use App\Models\PhoneVerificationCode;
use App\Models\User;
use App\Services\Sms\SmsDeliveryException;
use App\Services\Sms\SmsFailureJournal;
use App\Services\Sms\SmsMessenger;
use App\Services\Sms\SmsTemplate;
use App\Support\PhoneNormalizer;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class PhoneVerificationService
{
    public function __construct(
        private readonly SmsMessenger $sms,
        private readonly SmsFailureJournal $failures,
    ) {}

    /**
     * Отказ в отправке — с машинным кодом и сроком.
     *
     * Три разные причины (пауза между отправками, взятый предел, отказ
     * оператора) отвечали одинаковым 422 с текстом в `errors.phone`. Клиент
     * не мог их различить: он не знал, сколько ждать, и заводить отсчёт было
     * не от чего, а человеку про отказ оператора писали «попробуйте позже»,
     * хотя ждать бессмысленно — нужен другой номер.
     *
     * Форма ответа прежняя (`message` + `errors.phone`), чтобы старые клиенты
     * продолжали показывать текст; `code` и `retry_after` добавлены рядом.
     */
    private function refuse(string $message, string $code, ?int $retryAfter = null): never
    {
        throw new HttpResponseException(response()->json([
            'message' => $message,
            'errors' => ['phone' => [$message]],
            'code' => $code,
            'retry_after' => $retryAfter,
        ], 422));
    }

    public function sendCode(User $user, string $rawPhone, ?Request $request = null): void
    {
        $phone = PhoneNormalizer::normalize($rawPhone);
        if ($phone === null) {
            throw ValidationException::withMessages([
                'phone' => ['Укажите корректный номер телефона (+7 и 10 цифр).'],
            ]);
        }

        $this->assertPhoneAvailable($user, $phone);
        $this->assertSendRateLimits($user, $phone, $request);

        $cooldown = (int) config('sms.verification.resend_cooldown_seconds', 60);
        $cacheKey = 'phone-verify:cooldown:'.$user->id;
        if ($cooldown > 0 && Cache::has($cacheKey)) {
            $expiresAt = (int) Cache::get($cacheKey);
            $seconds = max(1, $expiresAt - time());
            $this->refuse(
                "Код уже отправлен. Запросить новый можно через {$seconds} сек.",
                'sms_cooldown',
                $seconds,
            );
        }

        PhoneVerificationCode::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $code = $this->generateCode();
        $ttl = (int) config('sms.verification.ttl_minutes', 10);

        PhoneVerificationCode::create([
            'user_id' => $user->id,
            'phone' => $phone,
            'code' => $code,
            'expires_at' => now()->addMinutes($ttl),
        ]);

        $template = $this->resolveVerificationTemplate($user);

        try {
            /*
             * Код уходит строкой, а не числом.
             *
             * Здесь стояло `[(int) $code]`, а в шаблоне — `%d`. Приведение к
             * числу съедает ведущие нули: код `001234` из базы уезжал в SMS
             * как «1234». Человек получал четыре цифры, форма требовала
             * шесть, и подтвердить номер было нельзя — ровно вторая жалоба
             * владельца от 09.10.
             *
             * Цена промаха: каждый десятый код начинается с нуля, каждый
             * сотый — с двух нулей. То есть один человек из десяти получал
             * код короче, чем ждёт форма.
             *
             * Проверено `php -r` на тех же значениях: 012345 → «12345»,
             * 001234 → «1234», 000123 → «123». Сторож — тест
             * `SmsCodeLengthIsOneTruthTest::test_leading_zeros_survive_the_sms`.
             */
            $this->sms->sendTemplate($phone, $template, [$code]);
        } catch (SmsDeliveryException $e) {
            Log::error('Phone verification SMS failed', [
                'user_id' => $user->id,
                'phone' => $phone,
                'reason' => $e->reason->value,
                'our_fault' => $e->reason->ourFault(),
                'error' => $e->getMessage(),
            ]);

            /*
             * Отказ виден владельцу в админке, а не только в журнале сервера.
             *
             * Решение Ж5 требует и того, и другого. Записывается всегда, в том
             * числе на стенде: сломанный шлюз на стенде — такая же новость.
             */
            $this->failures->record(
                $e->reason,
                (string) config('sms.driver', 'iqsms'),
                $e->getMessage(),
            );

            if (app()->environment(['local', 'testing'])) {
                Log::info('Phone verification code fallback (dev)', [
                    'user_id' => $user->id,
                    'phone' => $phone,
                    'code' => $code,
                ]);
            } else {
                /*
                 * Текст отказа зависит от причины — решение Ж5 от 09.10.
                 *
                 * До 09.10 здесь стояла одна фраза на все случаи: «Оператор
                 * связи отклонил отправку на этот номер. Проверьте номер или
                 * укажите другой». Её получал и человек с верным номером,
                 * когда у нас не было ключей шлюза, не согласована подпись
                 * отправителя, кончились деньги или шлюз не ответил. Именно
                 * это и было на снимке владельца: номер +7 938 410-00-24
                 * записан верно, а сервис сказал, что дело в номере.
                 *
                 * Теперь «проверьте номер» говорится только там, где это
                 * сказал сам шлюз (`SmsFailureReason::BadNumber`). Во всех
                 * остальных случаях, включая «причина неизвестна», — «сейчас
                 * не получается отправить код», и виноват сервис.
                 *
                 * Срока у такого отказа нет: `retry_after` остаётся null,
                 * кнопка не блокируется, человек возвращается на шаг ввода.
                 */
                $this->refuse($e->reason->message(), $e->reason->clientCode());
            }
        }

        if ($cooldown > 0) {
            Cache::put($cacheKey, time() + $cooldown, $cooldown);
        }
        $this->hitSendRateLimits($user, $phone, $request);
    }

    public function verifyCode(User $user, string $rawPhone, string $code): User
    {
        $phone = PhoneNormalizer::normalize($rawPhone);
        if ($phone === null) {
            throw ValidationException::withMessages([
                'phone' => ['Укажите корректный номер телефона.'],
            ]);
        }

        /*
         * Длина — из того же места, что у генератора (решение З1).
         *
         * Здесь стояло `/^\d{6}$/` с текстом «Код должен состоять из 6 цифр»,
         * и это была вторая независимая запись той же шестёрки. Смена
         * настройки меняла код в SMS и не меняла проверку: сервер отвергал
         * собственный код.
         */
        $length = self::codeLength();
        $code = trim($code);
        if (! preg_match('/^\d{'.$length.'}$/', $code)) {
            throw ValidationException::withMessages([
                'code' => ['Код состоит из '.$length.' цифр.'],
            ]);
        }

        $record = PhoneVerificationCode::query()
            ->where('user_id', $user->id)
            ->where('phone', $phone)
            ->whereNull('used_at')
            ->latest('id')
            ->first();

        if (! $record) {
            throw ValidationException::withMessages([
                'code' => ['Код не найден. Запросите новый.'],
            ]);
        }

        if ($record->isExpired()) {
            throw ValidationException::withMessages([
                'code' => ['Срок действия кода истёк. Запросите новый.'],
            ]);
        }

        $maxAttempts = (int) config('sms.verification.max_verify_attempts', 5);
        if ($record->attempts >= $maxAttempts) {
            throw ValidationException::withMessages([
                'code' => ['Превышено число попыток. Запросите новый код.'],
            ]);
        }

        if (! $record->matches($code)) {
            $record->increment('attempts');
            throw ValidationException::withMessages([
                'code' => ['Неверный код подтверждения.'],
            ]);
        }

        $this->assertPhoneAvailable($user, $phone);

        $record->update(['used_at' => now()]);

        $firstPhoneVerify = $user->phone_verified_at === null;

        $user->forceFill([
            'phone' => $phone,
            'phone_verified_at' => now(),
        ])->save();

        if ($firstPhoneVerify) {
            app(\Modules\Billing\Services\FirstHundredService::class)->tryGrant($user->fresh());
            app(\Modules\Billing\Services\ReferralService::class)->onPhoneVerified($user->fresh());
        }

        return $user->fresh(['profile']);
    }

    /**
     * Длина кода — из настройки, и больше ниоткуда (решение З1).
     *
     * Публичный метод, потому что по нему строится ответ на запрос кода:
     * форма берёт длину из ответа сервера, а не знает её заранее.
     */
    public static function codeLength(): int
    {
        return max(6, min(8, (int) config('sms.verification.code_length', 6)));
    }

    private function generateCode(): string
    {
        $length = self::codeLength();

        return str_pad((string) random_int(0, (10 ** $length) - 1), $length, '0', STR_PAD_LEFT);
    }

    private function resolveVerificationTemplate(User $user): SmsTemplate
    {
        if ($user->phone !== null && $user->phone_verified_at !== null) {
            return SmsTemplate::PhoneChange;
        }

        return SmsTemplate::Verification;
    }

    private function assertPhoneAvailable(User $user, string $phone): void
    {
        $taken = User::query()
            ->where('phone', $phone)
            ->where('id', '!=', $user->id)
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages([
                'phone' => ['Этот номер уже привязан к другому аккаунту.'],
            ]);
        }
    }

    private function assertSendRateLimits(User $user, string $phone, ?Request $request): void
    {
        $limits = config('sms.rate_limits', []);
        $checks = [
            ['key' => 'phone-send:user:'.$user->id, 'cfg' => $limits['send_per_user'] ?? []],
            ['key' => 'phone-send:phone:'.$phone, 'cfg' => $limits['send_per_phone'] ?? []],
        ];

        if ($request !== null) {
            $checks[] = [
                'key' => 'phone-send:ip:'.$request->ip(),
                'cfg' => $limits['send_per_ip'] ?? [],
            ];
        }

        foreach ($checks as $check) {
            $max = (int) ($check['cfg']['max'] ?? 0);
            $decay = (int) ($check['cfg']['decay_minutes'] ?? 60);
            if ($max <= 0) {
                continue;
            }

            if (RateLimiter::tooManyAttempts($check['key'], $max)) {
                $seconds = RateLimiter::availableIn($check['key']);
                $this->refuse(
                    "Слишком много запросов SMS. Повторите через {$seconds} сек.",
                    'sms_rate_limited',
                    $seconds,
                );
            }
        }
    }

    private function hitSendRateLimits(User $user, string $phone, ?Request $request): void
    {
        $limits = config('sms.rate_limits', []);
        $hits = [
            ['key' => 'phone-send:user:'.$user->id, 'cfg' => $limits['send_per_user'] ?? []],
            ['key' => 'phone-send:phone:'.$phone, 'cfg' => $limits['send_per_phone'] ?? []],
        ];

        if ($request !== null) {
            $hits[] = [
                'key' => 'phone-send:ip:'.$request->ip(),
                'cfg' => $limits['send_per_ip'] ?? [],
            ];
        }

        foreach ($hits as $hit) {
            $decay = (int) ($hit['cfg']['decay_minutes'] ?? 60);
            if ($decay <= 0) {
                continue;
            }
            RateLimiter::hit($hit['key'], $decay * 60);
        }
    }
}
