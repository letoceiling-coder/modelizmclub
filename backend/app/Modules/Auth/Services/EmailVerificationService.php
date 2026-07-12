<?php

namespace Modules\Auth\Services;

use App\Models\EmailVerificationCode;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Modules\Auth\Notifications\VerificationCodeNotification;

class EmailVerificationService
{
    public function issueCode(User $user): EmailVerificationCode
    {
        EmailVerificationCode::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $record = EmailVerificationCode::create([
            'user_id' => $user->id,
            'code' => $code,
            'expires_at' => now()->addMinutes(30),
        ]);

        // Deliver the code by email. If the mail transport is unavailable we keep
        // the code in the log as an emergency fallback so registration never 500s.
        try {
            $user->notify(new VerificationCodeNotification($code));
        } catch (\Throwable $e) {
            Log::warning('Verification email could not be sent; code retained in log as fallback', [
                'user_id' => $user->id,
                'email' => $user->email,
                'code' => $code,
                'error' => $e->getMessage(),
            ]);
        }

        return $record;
    }

    public function generateCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    public function sendCode(string $email, string $code, string $context = 'verification'): void
    {
        try {
            Notification::route('mail', $email)
                ->notify(new VerificationCodeNotification($code));
        } catch (\Throwable $e) {
            Log::warning('Verification email could not be sent; code retained in log as fallback', [
                'email' => $email,
                'context' => $context,
                'code' => $code,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
