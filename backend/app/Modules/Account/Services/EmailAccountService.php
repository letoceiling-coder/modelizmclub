<?php

namespace Modules\Account\Services;

use App\Models\PendingEmailChange;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Auth\Services\EmailVerificationService;

class EmailAccountService
{
    public function __construct(
        private readonly EmailVerificationService $verification,
    ) {}

    public function requestChange(User $user, string $newEmail): void
    {
        $newEmail = Str::lower(trim($newEmail));

        if ($newEmail === $user->email) {
            throw ValidationException::withMessages([
                'new_email' => ['Новый email совпадает с текущим.'],
            ]);
        }

        if (User::withTrashed()->where('email', $newEmail)->exists()) {
            throw ValidationException::withMessages([
                'new_email' => ['Этот email уже занят.'],
            ]);
        }

        $code = $this->verification->generateCode();
        PendingEmailChange::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'new_email' => $newEmail,
                'code_hash' => Hash::make($code),
                'expires_at' => now()->addHour(),
            ],
        );

        $this->verification->sendCode($newEmail, $code, 'email_change');
    }

    public function confirmChange(User $user, string $code): void
    {
        $pending = PendingEmailChange::query()->where('user_id', $user->id)->first();

        if (! $pending || ! $pending->isValid($code)) {
            throw ValidationException::withMessages([
                'code' => ['Неверный или просроченный код.'],
            ]);
        }

        $user->forceFill([
            'email' => $pending->new_email,
            'email_verified_at' => now(),
        ])->save();

        $pending->delete();
    }

    public function resendVerification(User $user): void
    {
        if ($user->email_verified_at) {
            throw ValidationException::withMessages([
                'email' => ['Email уже подтверждён.'],
            ]);
        }

        $this->verification->issueCode($user);
    }

    public function resendEmailChangeCode(User $user): void
    {
        $pending = PendingEmailChange::query()->where('user_id', $user->id)->first();

        if (! $pending) {
            throw ValidationException::withMessages([
                'email' => ['Нет ожидающей смены email.'],
            ]);
        }

        $code = $this->verification->generateCode();
        $pending->update([
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addHour(),
        ]);

        $this->verification->sendCode($pending->new_email, $code, 'email_change_resend');
    }
}
