<?php

namespace App\Support;

use App\Models\SystemSetting;

final class ReferralProgramConfig
{
    public const SETTING_KEY = 'referral_program';

    /** @return array{enabled: bool, per_invite: int, max_bonus: int} */
    public static function get(): array
    {
        $raw = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');

        if (! is_array($raw)) {
            return self::defaults();
        }

        return [
            'enabled' => (bool) ($raw['enabled'] ?? true),
            'per_invite' => max(1, (int) ($raw['per_invite'] ?? 1)),
            'max_bonus' => max(1, (int) ($raw['max_bonus'] ?? 10)),
        ];
    }

    /** @return array{enabled: bool, per_invite: int, max_bonus: int} */
    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'per_invite' => 1,
            'max_bonus' => 10,
        ];
    }
}
