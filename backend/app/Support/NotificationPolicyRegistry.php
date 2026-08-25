<?php

namespace App\Support;

final class NotificationPolicyRegistry
{
    public const SETTING_KEY = 'notifications.policy';

    /** @var list<string> */
    public const TIERS = ['registered', 'verified', 'subscriber'];

    /** @var list<string> */
    public const CHANNELS = ['in_app', 'max'];

    /**
     * Map InAppNotification `type` (and aliases) onto a registry key.
     *
     * @var array<string, string>
     */
    public const TYPE_MAP = [
        'friend_request' => 'friend_requests',
        'friend_requests' => 'friend_requests',
        'friend_accept' => 'friend_requests',
        'comment' => 'comments',
        'comments' => 'comments',
        'like' => 'likes',
        'likes' => 'likes',
        'message' => 'messages',
        'messages' => 'messages',
        'subscription_post' => 'subscription_posts',
        'subscription_posts' => 'subscription_posts',
        'follower' => 'followers',
        'followers' => 'followers',
        'call' => 'calls',
        'calls' => 'calls',
        'moderation' => 'moderation',
        'listing' => 'listings',
        'listings' => 'listings',
        'deal' => 'deals',
        'deals' => 'deals',
        'promo' => 'promo',
        'system' => 'promo',
        'report' => 'report',
    ];

    /**
     * @return list<array{
     *   key: string,
     *   group: string,
     *   label: string,
     *   hint: string,
     *   default_min_tier: string,
     *   default_enabled: bool,
     *   default_user_can_toggle: bool,
     *   default_channels: list<string>,
     *   show_in_cabinet: bool
     * }>
     */
    public static function types(): array
    {
        return [
            ['key' => 'friend_requests', 'group' => 'social', 'label' => 'Заявки в друзья', 'hint' => 'Новая заявка и принятие', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => true, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'comments', 'group' => 'social', 'label' => 'Комментарии', 'hint' => 'Комментарий к вашей публикации или ответ вам', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => true, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'likes', 'group' => 'social', 'label' => 'Лайки', 'hint' => 'Лайк вашей публикации', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => true, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'followers', 'group' => 'social', 'label' => 'Новые подписчики', 'hint' => 'Кто-то подписался на вас', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => true, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'subscription_posts', 'group' => 'social', 'label' => 'Посты в подписках', 'hint' => 'Новая публикация автора, на которого вы подписаны', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => true, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'calls', 'group' => 'social', 'label' => 'Звонки', 'hint' => 'Входящий звонок', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => true, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'messages', 'group' => 'social', 'label' => 'Сообщения', 'hint' => 'Одно уведомление на диалог, пока есть непрочитанные', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => true, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'moderation', 'group' => 'service', 'label' => 'Модерация', 'hint' => 'Решение по посту, каналу или сообществу', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => false, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'listings', 'group' => 'service', 'label' => 'Объявления', 'hint' => 'Объявление опубликовано, отклонено или отправлено на доработку', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => false, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'deals', 'group' => 'service', 'label' => 'Безопасные сделки', 'hint' => 'Смена статуса сделки', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => false, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
            ['key' => 'report', 'group' => 'service', 'label' => 'Жалобы (модераторам)', 'hint' => 'Новая жалоба — только сотрудникам', 'default_min_tier' => 'registered', 'default_enabled' => true, 'default_user_can_toggle' => false, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => false],
            ['key' => 'promo', 'group' => 'marketing', 'label' => 'Промо и рассылки', 'hint' => 'Промокоды и объявления платформы', 'default_min_tier' => 'verified', 'default_enabled' => true, 'default_user_can_toggle' => true, 'default_channels' => ['in_app', 'max'], 'show_in_cabinet' => true],
        ];
    }

    /** @return array<string, array<string, mixed>> */
    public static function typesByKey(): array
    {
        $map = [];
        foreach (self::types() as $row) {
            $map[$row['key']] = $row;
        }

        return $map;
    }

    public static function mapType(string $rawType): ?string
    {
        return self::TYPE_MAP[$rawType] ?? null;
    }

    /** @return list<string> */
    public static function toggleableKeys(): array
    {
        $keys = [];
        foreach (self::types() as $row) {
            if ($row['default_user_can_toggle']) {
                $keys[] = $row['key'];
            }
        }

        return $keys;
    }

    /** @return array<string, string> */
    public static function groupLabels(): array
    {
        return [
            'social' => 'Социальные',
            'service' => 'Сервисные',
            'marketing' => 'Маркетинг',
        ];
    }

    public static function normalizeTier(mixed $tier, string $fallback = 'registered'): string
    {
        $value = is_string($tier) ? $tier : '';

        return in_array($value, self::TIERS, true) ? $value : $fallback;
    }

    public static function tierRank(string $tier): int
    {
        return match ($tier) {
            'subscriber' => 2,
            'verified' => 1,
            default => 0,
        };
    }

    /**
     * @param  array<string, mixed>  $patch
     * @param  array<string, mixed>  $meta
     * @return array{enabled: bool, min_tier: string, user_can_toggle: bool, default_enabled: bool, channels: list<string>}
     */
    public static function normalizeType(array $patch, array $meta): array
    {
        $minTier = self::normalizeTier($patch['min_tier'] ?? $meta['default_min_tier'], (string) $meta['default_min_tier']);

        $channels = $patch['channels'] ?? $meta['default_channels'];
        $channels = is_array($channels) ? $channels : $meta['default_channels'];
        $channels = array_values(array_intersect(self::CHANNELS, array_map('strval', $channels)));
        if ($channels === []) {
            $channels = $meta['default_channels'];
        }

        return [
            'enabled' => array_key_exists('enabled', $patch) ? (bool) $patch['enabled'] : (bool) $meta['default_enabled'],
            'min_tier' => $minTier,
            'user_can_toggle' => array_key_exists('user_can_toggle', $patch)
                ? (bool) $patch['user_can_toggle']
                : (bool) $meta['default_user_can_toggle'],
            'default_enabled' => array_key_exists('default_enabled', $patch)
                ? (bool) $patch['default_enabled']
                : (bool) $meta['default_enabled'],
            'channels' => $channels,
        ];
    }

    /** @return array<string, mixed> */
    public static function defaultConfig(): array
    {
        $types = [];
        foreach (self::types() as $row) {
            $types[$row['key']] = self::normalizeType([], $row);
        }

        return [
            'version' => 1,
            'types' => $types,
        ];
    }
}
