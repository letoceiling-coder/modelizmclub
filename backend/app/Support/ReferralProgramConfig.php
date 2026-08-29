<?php

namespace App\Support;

use App\Models\SystemSetting;

final class ReferralProgramConfig
{
    public const SETTING_KEY = 'referral_program';

    /**
     * @return array{
     *   enabled: bool,
     *   per_invite: int,
     *   max_bonus: int,
     *   reward_kopecks: int,
     *   reward_listing_credits: bool,
     *   reward_subscription_days: int
     * }
     */
    public static function get(): array
    {
        $raw = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        $base = is_array($raw) ? $raw : [];
        $defaults = self::defaults();

        return [
            'enabled' => (bool) ($base['enabled'] ?? $defaults['enabled']),
            'per_invite' => max(0, (int) ($base['per_invite'] ?? $defaults['per_invite'])),
            'max_bonus' => max(0, (int) ($base['max_bonus'] ?? $defaults['max_bonus'])),
            'reward_kopecks' => max(0, (int) ($base['reward_kopecks'] ?? $defaults['reward_kopecks'])),
            'reward_listing_credits' => array_key_exists('reward_listing_credits', $base)
                ? (bool) $base['reward_listing_credits']
                : $defaults['reward_listing_credits'],
            'reward_subscription_days' => max(0, (int) ($base['reward_subscription_days'] ?? $defaults['reward_subscription_days'])),
        ];
    }

    /** @return array{enabled: bool, per_invite: int, max_bonus: int, reward_kopecks: int, reward_listing_credits: bool, reward_subscription_days: int} */
    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'per_invite' => 1,
            'max_bonus' => 10,
            'reward_kopecks' => 0,
            'reward_listing_credits' => true,
            'reward_subscription_days' => 0,
        ];
    }

    /** @return array{enabled: bool, per_invite: int, max_bonus: int, reward_kopecks: int, reward_listing_credits: bool, reward_subscription_days: int} */
    public static function normalize(mixed $raw): array
    {
        $defaults = self::defaults();
        $base = is_array($raw) ? $raw : [];

        $enabled = $base['enabled'] ?? $defaults['enabled'];
        if (is_string($enabled)) {
            $enabled = filter_var($enabled, FILTER_VALIDATE_BOOLEAN);
        }

        $listing = array_key_exists('reward_listing_credits', $base)
            ? $base['reward_listing_credits']
            : $defaults['reward_listing_credits'];
        if (is_string($listing)) {
            $listing = filter_var($listing, FILTER_VALIDATE_BOOLEAN);
        }

        return [
            'enabled' => (bool) $enabled,
            'per_invite' => max(0, (int) ($base['per_invite'] ?? $defaults['per_invite'])),
            'max_bonus' => max(0, (int) ($base['max_bonus'] ?? $defaults['max_bonus'])),
            'reward_kopecks' => max(0, (int) ($base['reward_kopecks'] ?? $defaults['reward_kopecks'])),
            'reward_listing_credits' => (bool) $listing,
            'reward_subscription_days' => max(0, min(3650, (int) ($base['reward_subscription_days'] ?? $defaults['reward_subscription_days']))),
        ];
    }
}
