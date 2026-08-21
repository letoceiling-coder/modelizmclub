<?php

namespace App\Support;

use App\Models\SystemSetting;
use App\Models\User;

final class FirstHundredPromo
{
    public const SETTING_KEY = 'first_hundred_stats';

    public const MAX_TOTAL = 100000;

    /** @return array{enabled: bool, total: int, plan_slug: string, bonus_kopecks: int} */
    public static function get(): array
    {
        $raw = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');

        return self::normalize($raw);
    }

    /** @return array{enabled: bool, total: int, plan_slug: string, bonus_kopecks: int} */
    public static function defaults(): array
    {
        return [
            'enabled' => false,
            'total' => 100,
            'plan_slug' => 'year',
            'bonus_kopecks' => 0,
        ];
    }

    /**
     * Canonical admin payload. `taken` is live and never stored.
     *
     * @return array{enabled: bool, total: int, plan_slug: string, bonus_kopecks: int}
     */
    public static function normalize(mixed $raw): array
    {
        $defaults = self::defaults();
        $base = is_array($raw) ? $raw : [];

        $total = (int) ($base['total'] ?? $defaults['total']);
        $total = max(0, min(self::MAX_TOTAL, $total));

        $planSlug = strtolower(trim((string) ($base['plan_slug'] ?? $defaults['plan_slug'])));
        if ($planSlug === '') {
            $planSlug = $defaults['plan_slug'];
        }

        $enabled = $base['enabled'] ?? $defaults['enabled'];
        if (is_string($enabled)) {
            $enabled = filter_var($enabled, FILTER_VALIDATE_BOOLEAN);
        }

        return [
            'enabled' => (bool) $enabled,
            'total' => $total,
            'plan_slug' => $planSlug,
            'bonus_kopecks' => max(0, (int) ($base['bonus_kopecks'] ?? 0)),
        ];
    }

    public static function takenCount(): int
    {
        return User::query()->where('is_first_hundred', true)->count();
    }

    public static function seatsOpen(): bool
    {
        $config = self::get();

        return $config['enabled'] && self::takenCount() < $config['total'];
    }

    /** True when this user currently holds a promo seat allowed by admin settings. */
    public static function coversUser(User $user): bool
    {
        $config = self::get();

        if (! $config['enabled'] || $config['total'] <= 0 || ! $user->is_first_hundred) {
            return false;
        }

        return self::coveredUserIds($config['total'])->contains((int) $user->id);
    }

    /** @return \Illuminate\Support\Collection<int, int> */
    public static function coveredUserIds(int $total): \Illuminate\Support\Collection
    {
        if ($total <= 0) {
            return collect();
        }

        return User::query()
            ->where('is_first_hundred', true)
            ->orderBy('first_hundred_granted_at')
            ->orderBy('id')
            ->limit($total)
            ->pluck('id')
            ->map(fn ($id) => (int) $id);
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
