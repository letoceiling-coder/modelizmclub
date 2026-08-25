<?php

namespace App\Services;

use App\Models\NotificationPreference;
use App\Models\User;
use App\Support\NotificationPolicyRegistry;
use Modules\Admin\Services\NotificationPolicySettingsService;

class NotificationPolicy
{
    public function __construct(
        private readonly NotificationPolicySettingsService $settings,
    ) {}

    public static function allows(User $user, string $rawType, string $channel = 'in_app'): bool
    {
        return app(self::class)->check($user, $rawType, $channel);
    }

    public function check(User $user, string $rawType, string $channel = 'in_app'): bool
    {
        $key = NotificationPolicyRegistry::mapType($rawType);
        if ($key === null) {
            return true;
        }

        $meta = NotificationPolicyRegistry::typesByKey()[$key] ?? null;
        if ($meta === null) {
            return true;
        }

        $config = $this->settings->mergedConfig()['types'][$key] ?? NotificationPolicyRegistry::normalizeType([], $meta);
        if (! ($config['enabled'] ?? true)) {
            return false;
        }

        $channels = is_array($config['channels'] ?? null) ? $config['channels'] : $meta['default_channels'];
        if (! in_array($channel, $channels, true)) {
            return false;
        }

        if (! $user->isModerator()) {
            $userTier = $this->userTier($user);
            if (NotificationPolicyRegistry::tierRank($userTier) < NotificationPolicyRegistry::tierRank((string) $config['min_tier'])) {
                return false;
            }
        }

        if ($config['user_can_toggle'] ?? false) {
            return $this->preferenceEnabled($user, $key, (bool) $config['default_enabled']);
        }

        return true;
    }

    public function userTier(User $user): string
    {
        if ($user->isModerator() || $user->hasActiveSubscription()) {
            return 'subscriber';
        }

        $phoneOk = $user->phone_verified_at !== null;
        $emailOk = ! $user->requiresEmailVerification();
        if ($emailOk && $phoneOk) {
            return 'verified';
        }

        return 'registered';
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function cabinetItems(User $user): array
    {
        $config = $this->settings->mergedConfig();
        $tier = $this->userTier($user);
        $items = [];

        foreach (NotificationPolicyRegistry::types() as $meta) {
            if (! ($meta['show_in_cabinet'] ?? true)) {
                continue;
            }

            $key = $meta['key'];
            $row = $config['types'][$key] ?? NotificationPolicyRegistry::normalizeType([], $meta);
            if (! ($row['enabled'] ?? true)) {
                continue;
            }

            $meetsTier = $user->isModerator()
                || NotificationPolicyRegistry::tierRank($tier) >= NotificationPolicyRegistry::tierRank((string) $row['min_tier']);
            $canToggle = (bool) ($row['user_can_toggle'] ?? false) && $meetsTier;
            $enabled = $this->preferenceEnabled($user, $key, (bool) $row['default_enabled']);

            $items[] = [
                'key' => $key,
                'group' => $meta['group'],
                'label' => $meta['label'],
                'hint' => $meta['hint'],
                'min_tier' => $row['min_tier'],
                'user_can_toggle' => (bool) ($row['user_can_toggle'] ?? false),
                'can_toggle' => $canToggle,
                'locked' => ! (bool) ($row['user_can_toggle'] ?? false),
                'meets_tier' => $meetsTier,
                'enabled' => $enabled,
                'channels' => $row['channels'],
            ];
        }

        return $items;
    }

    public function isToggleable(string $channel, string $type): bool
    {
        if ($channel === 'max' && $type === 'all') {
            return true;
        }

        if ($channel !== 'in_app') {
            return false;
        }

        $meta = NotificationPolicyRegistry::typesByKey()[$type] ?? null;
        if ($meta === null) {
            return false;
        }

        $row = $this->settings->mergedConfig()['types'][$type] ?? NotificationPolicyRegistry::normalizeType([], $meta);

        return (bool) ($row['enabled'] ?? false) && (bool) ($row['user_can_toggle'] ?? false);
    }

    private function preferenceEnabled(User $user, string $key, bool $default): bool
    {
        $row = NotificationPreference::query()
            ->where('user_id', $user->id)
            ->where('channel', 'in_app')
            ->where('type', $key)
            ->first();

        if ($row === null && $key === 'promo') {
            $row = NotificationPreference::query()
                ->where('user_id', $user->id)
                ->where('type', 'promo')
                ->first();
        }

        return $row === null ? $default : $row->enabled;
    }
}
