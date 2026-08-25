<?php

namespace App\Support;

use App\Models\User;

final class UserLabel
{
    public static function display(User $user): string
    {
        $name = $user->profile?->display_name ?: $user->name;
        $name = is_string($name) ? trim($name) : '';

        return $name !== '' ? $name : 'Пользователь';
    }
}
