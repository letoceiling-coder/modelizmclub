<?php

namespace Modules\Auth\Data;

use App\Enums\PhoneVerificationChannel;
use App\Enums\PhoneVerificationPhase;

readonly class PhoneVerificationSessionView
{
    public function __construct(
        public string $sessionId,
        public PhoneVerificationChannel $channel,
        public PhoneVerificationPhase $phase,
        public ?int $codeLength,
        public string $hint,
        public bool $completed,
        public bool $failed,
    ) {}

    /** @return array<string, mixed> */
    public function toResponseData(): array
    {
        return [
            'session_id' => $this->sessionId,
            'verification_mode' => $this->channel->value,
            'phase' => $this->phase->value,
            'code_length' => $this->codeLength,
            'hint' => $this->hint,
            'completed' => $this->completed,
            'failed' => $this->failed,
        ];
    }
}
