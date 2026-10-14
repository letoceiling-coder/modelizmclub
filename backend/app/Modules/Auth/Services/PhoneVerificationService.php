<?php

namespace Modules\Auth\Services;

use App\Enums\PhoneVerificationChannel;
use App\Enums\PhoneVerificationPhase;
use App\Models\PhoneVerificationCode;
use App\Models\User;
use App\Services\Sms\IqSmsOtpClient;
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
use Modules\Auth\Data\PhoneVerificationSendResult;
use Modules\Auth\Data\PhoneVerificationSessionView;

class PhoneVerificationService
{
    public function __construct(
        private readonly SmsMessenger $sms,
        private readonly SmsFailureJournal $failures,
        private readonly IqSmsOtpClient $iqOtp,
    ) {}

    private function refuse(string $message, string $code, ?int $retryAfter = null): never
    {
        throw new HttpResponseException(response()->json([
            'message' => $message,
            'errors' => ['phone' => [$message]],
            'code' => $code,
            'retry_after' => $retryAfter,
        ], 422));
    }

    public function sendCode(User $user, string $rawPhone, ?Request $request = null): PhoneVerificationSendResult
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
        $sessionId = (string) str()->uuid();
        $channel = self::mobileIdEnabled()
            ? PhoneVerificationChannel::MobileId
            : PhoneVerificationChannel::Classic;
        $phase = $channel === PhoneVerificationChannel::MobileId
            ? PhoneVerificationPhase::AwaitingPush
            : PhoneVerificationPhase::AwaitingSms;

        $record = PhoneVerificationCode::create([
            'user_id' => $user->id,
            'session_id' => $sessionId,
            'phone' => $phone,
            'channel' => $channel,
            'phase' => $phase,
            'code' => $code,
            'expires_at' => now()->addMinutes($ttl),
        ]);

        $template = $this->resolveVerificationTemplate($user);

        try {
            $text = $template->render([$code]);
            Log::info('Phone verification SMS payload', [
                'phone' => $phone,
                'session_id' => $sessionId,
                'channel' => $channel->value,
                'code_len' => strlen($code),
                'text' => $text,
            ]);

            $options = [];
            if ($channel === PhoneVerificationChannel::MobileId) {
                $callback = $this->statusCallbackUrl();
                if ($callback !== null) {
                    $options['status_callback_url'] = $callback;
                }
                $options['client_id'] = $sessionId;
            }

            $gatewayResponse = $this->sms->sendTemplate($phone, $template, [$code], $options);
            $smscId = $gatewayResponse['messages'][0]['smscId'] ?? null;
            if ($smscId !== null && $smscId !== '') {
                $record->update(['iqsms_message_id' => (string) $smscId]);
            }
        } catch (SmsDeliveryException $e) {
            Log::error('Phone verification SMS failed', [
                'user_id' => $user->id,
                'phone' => $phone,
                'reason' => $e->reason->value,
                'error' => $e->getMessage(),
            ]);

            $this->failures->record(
                $e->reason,
                (string) config('sms.driver', 'iqsms'),
                $e->getMessage(),
            );

            $record->update(['phase' => PhoneVerificationPhase::Failed]);

            if (app()->environment(['local', 'testing'])) {
                Log::info('Phone verification code fallback (dev)', [
                    'user_id' => $user->id,
                    'phone' => $phone,
                    'code' => $code,
                ]);
            } else {
                $this->refuse($e->reason->message(), $e->reason->clientCode());
            }
        }

        if ($cooldown > 0) {
            Cache::put($cacheKey, time() + $cooldown, $cooldown);
        }
        $this->hitSendRateLimits($user, $phone, $request);

        return $this->buildSendResult($record->fresh());
    }

    public function sessionView(User $user, string $sessionId): PhoneVerificationSessionView
    {
        $record = PhoneVerificationCode::query()
            ->where('session_id', $sessionId)
            ->where('user_id', $user->id)
            ->first();

        if (! $record) {
            throw ValidationException::withMessages([
                'session_id' => ['Сессия подтверждения не найдена.'],
            ]);
        }

        return $this->buildSessionView($record, $user);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handleIqSmsWebhook(array $payload): void
    {
        if (($payload['type'] ?? null) === 'otp_required') {
            $messageId = (string) ($payload['message_id'] ?? '');
            $phone = PhoneNormalizer::normalize((string) ($payload['phone'] ?? ''));
            $otpToken = (string) ($payload['otp_token'] ?? '');

            $record = $this->findOpenRecordByMessageId($messageId)
                ?? ($phone !== null
                    ? PhoneVerificationCode::query()
                        ->where('phone', $phone)
                        ->whereNull('used_at')
                        ->where('channel', PhoneVerificationChannel::MobileId)
                        ->latest('id')
                        ->first()
                    : null);

            if (! $record || $otpToken === '') {
                Log::warning('iqsms otp_required without matching session', [
                    'message_id' => $messageId,
                    'phone' => $phone,
                ]);

                return;
            }

            $record->storeOtpToken($otpToken);
            $record->update([
                'phase' => PhoneVerificationPhase::OtpRequired,
                'iqsms_message_id' => $messageId !== '' ? $messageId : $record->iqsms_message_id,
            ]);

            Log::info('Phone verification otp_required', [
                'session_id' => $record->session_id,
                'message_id' => $messageId,
            ]);

            return;
        }

        $status = strtolower((string) ($payload['status'] ?? ''));
        if ($status === '') {
            return;
        }

        $messageId = (string) ($payload['message_id'] ?? $payload['smscId'] ?? '');
        $record = $this->findOpenRecordByMessageId($messageId);

        if (! $record) {
            Log::info('iqsms status webhook without session', ['status' => $status, 'message_id' => $messageId]);

            return;
        }

        if ($status === 'delivered') {
            $this->completeVerificationFromRecord($record);

            return;
        }

        if (in_array($status, ['delivery error', 'failed', 'smsc reject'], true)) {
            $record->update(['phase' => PhoneVerificationPhase::Failed]);
            Log::warning('Phone verification delivery failed via webhook', [
                'session_id' => $record->session_id,
                'status' => $status,
            ]);
        }
    }

    public function verifyCode(User $user, string $rawPhone, string $code, ?string $sessionId = null): User
    {
        $phone = PhoneNormalizer::normalize($rawPhone);
        if ($phone === null) {
            throw ValidationException::withMessages([
                'phone' => ['Укажите корректный номер телефона.'],
            ]);
        }

        $record = $this->resolveRecordForVerify($user, $phone, $sessionId);

        if ($record->isUsed() || $record->phase === PhoneVerificationPhase::Delivered) {
            if ($user->phone === $phone && $user->phone_verified_at !== null) {
                return $user->fresh(['profile']);
            }
        }

        if ($record->isExpired()) {
            throw ValidationException::withMessages([
                'code' => ['Срок действия кода истёк. Запросите новый.'],
            ]);
        }

        if ($record->phase === PhoneVerificationPhase::Failed) {
            throw ValidationException::withMessages([
                'code' => ['Не удалось доставить SMS. Запросите код заново или укажите другой номер.'],
            ]);
        }

        if ($record->channel === PhoneVerificationChannel::MobileId
            && $record->phase === PhoneVerificationPhase::AwaitingPush) {
            throw ValidationException::withMessages([
                'code' => ['Подтвердите уведомление на телефоне или дождитесь SMS с кодом.'],
            ]);
        }

        $maxAttempts = (int) config('sms.verification.max_verify_attempts', 5);
        if ($record->attempts >= $maxAttempts) {
            throw ValidationException::withMessages([
                'code' => ['Превышено число попыток. Запросите новый код.'],
            ]);
        }

        if ($record->channel === PhoneVerificationChannel::MobileId
            && $record->phase === PhoneVerificationPhase::OtpRequired) {
            $this->assertOtpCodeFormat($code);
            $otpToken = $record->readOtpToken();
            if ($otpToken === null) {
                throw ValidationException::withMessages([
                    'code' => ['Сессия OTP истекла. Запросите код заново.'],
                ]);
            }

            try {
                $this->iqOtp->verify($otpToken, $code);
            } catch (SmsDeliveryException $e) {
                $record->increment('attempts');
                throw ValidationException::withMessages([
                    'code' => [$e->getMessage()],
                ]);
            }

            return $this->completeVerificationFromRecord($record);
        }

        $this->assertClassicCodeFormat($code);

        if (! $record->matches($code)) {
            $record->increment('attempts');
            throw ValidationException::withMessages([
                'code' => ['Неверный код подтверждения.'],
            ]);
        }

        return $this->completeVerificationFromRecord($record);
    }

    public static function codeLength(): int
    {
        return max(6, min(8, (int) config('sms.verification.code_length', 6)));
    }

    public static function otpCodeLength(): int
    {
        return max(4, min(8, (int) config('sms.iqsms.otp_code_length', 4)));
    }

    public static function mobileIdEnabled(): bool
    {
        if ((string) config('sms.driver', 'iqsms') !== 'iqsms') {
            return false;
        }

        return filter_var(config('sms.iqsms.mobile_id_enabled', false), FILTER_VALIDATE_BOOL);
    }

    private function completeVerificationFromRecord(PhoneVerificationCode $record): User
    {
        $user = $record->user;
        $phone = $record->phone;

        $this->assertPhoneAvailable($user, $phone);

        if (! $record->isUsed()) {
            $record->update([
                'used_at' => now(),
                'phase' => PhoneVerificationPhase::Delivered,
            ]);
        }

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

    private function resolveRecordForVerify(User $user, string $phone, ?string $sessionId): PhoneVerificationCode
    {
        if ($sessionId !== null && $sessionId !== '') {
            $record = PhoneVerificationCode::query()
                ->where('session_id', $sessionId)
                ->where('user_id', $user->id)
                ->first();
            if ($record) {
                return $record;
            }
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

        return $record;
    }

    private function findOpenRecordByMessageId(string $messageId): ?PhoneVerificationCode
    {
        if ($messageId === '') {
            return null;
        }

        return PhoneVerificationCode::query()
            ->where('iqsms_message_id', $messageId)
            ->whereNull('used_at')
            ->latest('id')
            ->first();
    }

    private function buildSendResult(PhoneVerificationCode $record): PhoneVerificationSendResult
    {
        $ttl = (int) config('sms.verification.ttl_minutes', 10);
        $cooldown = (int) config('sms.verification.resend_cooldown_seconds', 60);
        $maxAttempts = (int) config('sms.verification.max_verify_attempts', 5);
        $poll = (int) config('sms.iqsms.poll_interval_seconds', 2);
        [$codeLength, $hint] = $this->hintForPhase($record);

        return new PhoneVerificationSendResult(
            sessionId: (string) $record->session_id,
            channel: $record->channel,
            phase: $record->phase,
            codeLength: $codeLength,
            hint: $hint,
            expiresInMinutes: $ttl,
            resendAfter: $cooldown,
            maxAttempts: $maxAttempts,
            pollIntervalSeconds: $poll,
        );
    }

    private function buildSessionView(PhoneVerificationCode $record, User $user): PhoneVerificationSessionView
    {
        $completed = $record->isUsed()
            || ($user->phone === $record->phone && $user->phone_verified_at !== null);
        $failed = $record->phase === PhoneVerificationPhase::Failed;
        [$codeLength, $hint] = $this->hintForPhase($record);

        return new PhoneVerificationSessionView(
            sessionId: (string) $record->session_id,
            channel: $record->channel,
            phase: $record->phase,
            codeLength: $codeLength,
            hint: $hint,
            completed: $completed,
            failed: $failed,
        );
    }

    /** @return array{0: ?int, 1: string} */
    private function hintForPhase(PhoneVerificationCode $record): array
    {
        if ($record->channel === PhoneVerificationChannel::Classic
            || $record->phase === PhoneVerificationPhase::AwaitingSms) {
            $len = self::codeLength();

            return [$len, "Введите код из {$len} цифр в SMS от Modelizm."];
        }

        if ($record->phase === PhoneVerificationPhase::OtpRequired) {
            $len = self::otpCodeLength();

            return [$len, 'Введите код из SMS (сообщение может прийти от оператора связи).'];
        }

        return [null, 'Подтвердите push-уведомление на телефоне или дождитесь SMS.'];
    }

    private function statusCallbackUrl(): ?string
    {
        $base = trim((string) config('sms.iqsms.status_callback_url', ''));
        if ($base === '') {
            $base = rtrim((string) config('app.url'), '/').'/api/v1/webhooks/iqsms/mobile-id';
        }

        $secret = (string) config('sms.iqsms.webhook_secret', '');
        if ($secret === '') {
            return $base;
        }

        return $base.(str_contains($base, '?') ? '&' : '?').'token='.rawurlencode($secret);
    }

    private function assertClassicCodeFormat(string $code): void
    {
        $length = self::codeLength();
        $code = trim($code);
        if (! preg_match('/^\d{'.$length.'}$/', $code)) {
            throw ValidationException::withMessages([
                'code' => ['Код состоит из '.$length.' цифр.'],
            ]);
        }
    }

    private function assertOtpCodeFormat(string $code): void
    {
        $length = self::otpCodeLength();
        $code = trim($code);
        if (! preg_match('/^\d{'.$length.'}$/', $code)) {
            throw ValidationException::withMessages([
                'code' => ['Код состоит из '.$length.' цифр.'],
            ]);
        }
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
