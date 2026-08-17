<?php

namespace App\Support;

use App\Models\SystemSetting;
use App\Models\User;

final class FirstHundredPromo
{
    public const SETTING_KEY = 'first_hundred_stats';

    /** @return array{enabled: bool, total: int, plan_slug: string, bonus_kopecks: int} */
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
            // Optional wallet bonus (kopecks) granted to each of the first N users (spec v4.0 §T10).
            'bonus_kopecks' => max(0, (int) ($raw['bonus_kopecks'] ?? 0)),
        ];
    }

    /** @return array{enabled: bool, total: int, plan_slug: string, bonus_kopecks: int} */
    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'total' => 100,
            'plan_slug' => 'year',
            'bonus_kopecks' => 0,
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
