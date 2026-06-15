<?php

namespace Modules\Auth\Services;

use App\Models\EmailVerificationCode;
use App\Models\User;
use Illuminate\Support\Facades\Log;

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

        Log::info('Email verification code issued', [
            'user_id' => $user->id,
            'email' => $user->email,
            'code' => $code,
        ]);

        return $record;
    }
}
