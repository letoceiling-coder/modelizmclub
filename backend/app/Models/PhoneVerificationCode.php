<?php

namespace App\Models;

use App\Enums\PhoneVerificationChannel;
use App\Enums\PhoneVerificationPhase;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class PhoneVerificationCode extends Model
{
    protected $fillable = [
        'user_id',
        'session_id',
        'phone',
        'channel',
        'phase',
        'iqsms_message_id',
        'otp_token',
        'code',
        'attempts',
        'expires_at',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'channel' => PhoneVerificationChannel::class,
            'phase' => PhoneVerificationPhase::class,
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isUsed(): bool
    {
        return $this->used_at !== null;
    }

    public function matches(string $code): bool
    {
        if ($this->code === null || $this->code === '') {
            return false;
        }

        return hash_equals($this->code, $code);
    }

    public function storeOtpToken(string $plainToken): void
    {
        $this->otp_token = Crypt::encryptString($plainToken);
    }

    public function readOtpToken(): ?string
    {
        if ($this->otp_token === null || $this->otp_token === '') {
            return null;
        }

        try {
            return Crypt::decryptString($this->otp_token);
        } catch (\Throwable) {
            return null;
        }
    }
}
