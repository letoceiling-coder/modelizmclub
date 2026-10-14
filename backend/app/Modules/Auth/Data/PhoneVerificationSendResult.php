<?php

namespace Modules\Auth\Data;

use App\Enums\PhoneVerificationChannel;
use App\Enums\PhoneVerificationPhase;

readonly class PhoneVerificationSendResult
{
    public function __construct(
        public string $sessionId,
        public PhoneVerificationChannel $channel,
        public PhoneVerificationPhase $phase,
        public ?int $codeLength,
        public string $hint,
        public int $expiresInMinutes,
        public int $resendAfter,
        public int $maxAttempts,
        public int $pollIntervalSeconds,
    ) {}

    /** @return array<string, mixed> */
    public function toResponseData(): array
    {
        return [
            'message' => $this->channel === PhoneVerificationChannel::MobileId
                ? 'Запрос отправлен. Подтвердите push или введите код из SMS.'
                : 'Код отправлен по SMS.',
            'session_id' => $this->sessionId,
            'verification_mode' => $this->channel->value,
            'phase' => $this->phase->value,
            'code_length' => $this->codeLength,
            'hint' => $this->hint,
            'expires_in_minutes' => $this->expiresInMinutes,
            'resend_after' => $this->resendAfter,
            'max_attempts' => $this->maxAttempts,
            'poll_interval_seconds' => $this->pollIntervalSeconds,
        ];
    }
}
