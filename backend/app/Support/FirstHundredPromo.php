<?php

namespace App\Support;

use App\Models\SystemSetting;
use App\Models\User;

final class FirstHundredPromo
{
    public const SETTING_KEY = 'first_hundred_stats';

    /** @return array{enabled: bool, total: int, plan_slug: string} */
    public static function get(): array
    {
        $raw = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');

        if (! is_array($raw)) {
            return self::defaults();
        }

        return [
            'enabled' => (bool) ($raw['enabled'] ?? true),
            'total' => max(1, (int) ($raw['total'] ?? 100)),
            'plan_slug' => (string) ($raw['plan_slug'] ?? 'year'),
        ];
    }

    /** @return array{enabled: bool, total: int, plan_slug: string} */
    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'total' => 100,
            'plan_slug' => 'year',
        ];
    }

    public static function takenCount(): int
    {
        return User::query()->where('is_first_hundred', true)->count();
    }

    /** @return array{taken: int, total: int, enabled: bool} */
    public static function publicStats(): array
    {
        $config = self::get();

        return [
            'taken' => self::takenCount(),
            'total' => $config['total'],
            'enabled' => $config['enabled'],
        ];
    }
}
