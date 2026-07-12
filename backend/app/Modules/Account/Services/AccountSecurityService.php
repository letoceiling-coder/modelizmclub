<?php

namespace Modules\Account\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AccountSecurityService
{
    public function changePassword(User $user, string $currentPassword, string $newPassword): void
    {
        if (! Hash::check($currentPassword, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Неверный текущий пароль.'],
            ]);
        }

        $user->forceFill(['password' => $newPassword])->save();
    }

    public function logoutOtherDevices(User $user): void
    {
        $current = $user->currentAccessToken();

        if (! $current) {
            return;
        }

        $user->tokens()->where('id', '!=', $current->id)->delete();
    }
}
