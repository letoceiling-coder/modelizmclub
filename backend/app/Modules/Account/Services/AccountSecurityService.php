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

    /**
     * Завершает все сеансы, кроме текущего, и возвращает их число.
     *
     * Возвращаемое число — не украшение. Раньше метод молча выходил, если
     * текущего токена нет, а контроллер в обоих случаях отвечал `ok`, и
     * страница показывала «Другие сеансы завершены», хотя сервер не тронул
     * ничего (аудит 12.09). Теперь вызывающий видит, что произошло: сколько
     * сеансов закрыто и было ли что закрывать.
     */
    public function logoutOtherDevices(User $user): int
    {
        $current = $user->currentAccessToken();

        if (! $current) {
            return 0;
        }

        return $user->tokens()->where('id', '!=', $current->id)->delete();
    }
}
