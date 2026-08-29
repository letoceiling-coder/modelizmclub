<?php

namespace App\Support;

use App\Models\PromoPool;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\Schema;

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
        $pool = self::activeGrantingPool();
        if ($pool) {
            return $pool->isGranting();
        }

        $config = self::get();

        return $config['enabled'] && self::takenCount() < $config['total'];
    }

    public static function activeGrantingPool(): ?PromoPool
    {
        if (! Schema::hasTable('promo_pools')) {
            return null;
        }

        return PromoPool::query()->granting()->first();
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

    /** @return array{taken: int, total: int, enabled: bool, expires_at: ?string} */
    public static function publicStats(): array
    {
        $pool = self::activeGrantingPool()
            ?? (Schema::hasTable('promo_pools')
                ? PromoPool::query()
                    ->where('auto_assign_on_register', true)
                    ->whereNull('completed_at')
                    ->orderByDesc('id')
                    ->first()
                : null);

        if ($pool) {
            return [
                'taken' => (int) $pool->current_activations,
                'total' => (int) $pool->max_activations,
                'enabled' => $pool->isGranting(),
                'expires_at' => $pool->expires_at?->toIso8601String(),
            ];
        }

        $config = self::get();

        return [
            'taken' => self::takenCount(),
            'total' => $config['total'],
            'enabled' => $config['enabled'],
            'expires_at' => null,
        ];
    }

    /** Keep the legacy banner/card in sync with promo pools. Does not reconcile seats. */
    public static function syncFromPool(PromoPool $pool): void
    {
        $granting = self::activeGrantingPool();
        $current = self::get();

        SystemSetting::query()->updateOrCreate(
            ['key' => self::SETTING_KEY],
            [
                'value' => [
                    'enabled' => $granting !== null,
                    'total' => $granting
                        ? max(1, (int) $granting->max_activations)
                        : max(1, (int) $pool->max_activations ?: $current['total']),
                    'plan_slug' => ($granting?->plan_slug ?: $pool->plan_slug) ?: $current['plan_slug'],
                    'bonus_kopecks' => max(0, (int) ($granting?->bonus_kopecks ?? $pool->bonus_kopecks ?? $current['bonus_kopecks'])),
                ],
                'group' => 'marketing',
            ],
        );
    }
}
