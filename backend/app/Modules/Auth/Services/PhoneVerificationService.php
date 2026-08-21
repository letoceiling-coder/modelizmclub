<?php

namespace Modules\Auth\Services;

use App\Models\PhoneVerificationCode;
use App\Models\User;
use App\Services\Sms\SmsDeliveryException;
use App\Services\Sms\SmsMessenger;
use App\Services\Sms\SmsTemplate;
use App\Support\PhoneNormalizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class PhoneVerificationService
{
    public function __construct(
        private readonly SmsMessenger $sms,
    ) {}

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
            throw ValidationException::withMessages([
                'phone' => ["Повторная отправка через {$seconds} сек."],
            ]);
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
            $this->sms->sendTemplate($phone, $template, [(int) $code]);
        } catch (SmsDeliveryException $e) {
            Log::error('Phone verification SMS failed', [
                'user_id' => $user->id,
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);

            if (app()->environment(['local', 'testing'])) {
                Log::info('Phone verification code fallback (dev)', [
                    'user_id' => $user->id,
                    'phone' => $phone,
                    'code' => $code,
                ]);
            } else {
                throw ValidationException::withMessages([
                    'phone' => ['Не удалось отправить SMS. Попробуйте позже.'],
                ]);
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

        $code = trim($code);
        if (! preg_match('/^\d{6}$/', $code)) {
            throw ValidationException::withMessages([
                'code' => ['Код должен состоять из 6 цифр.'],
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
        }

        return $user->fresh(['profile']);
    }

    private function generateCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
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
                throw ValidationException::withMessages([
                    'phone' => ["Слишком много запросов SMS. Повторите через {$seconds} сек."],
                ]);
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
