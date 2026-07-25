<?php

namespace App\Support;

use App\Models\SystemSetting;

final class BannerCarouselConfig
{
    public const SETTING_KEY = 'banners.carousel';

    /** @return array{enabled: bool, placement: string, autoplay_seconds: int, max_slides: int} */
    public static function get(): array
    {
        $raw = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');

        if (! is_array($raw)) {
            return self::defaults();
        }

        return [
            'enabled' => (bool) ($raw['enabled'] ?? true),
            'placement' => is_string($raw['placement'] ?? null) && $raw['placement'] !== ''
                ? $raw['placement']
                : 'events',
            'autoplay_seconds' => max(3, min(120, (int) ($raw['autoplay_seconds'] ?? 10))),
            'max_slides' => max(1, min(10, (int) ($raw['max_slides'] ?? 5))),
        ];
    }

    /** @param array<string, mixed> $patch */
    public static function save(array $patch): array
    {
        $current = self::get();
        $next = [
            'enabled' => array_key_exists('enabled', $patch) ? (bool) $patch['enabled'] : $current['enabled'],
            'placement' => isset($patch['placement']) && is_string($patch['placement']) && $patch['placement'] !== ''
                ? $patch['placement']
                : $current['placement'],
            'autoplay_seconds' => array_key_exists('autoplay_seconds', $patch)
                ? max(3, min(120, (int) $patch['autoplay_seconds']))
                : $current['autoplay_seconds'],
            'max_slides' => array_key_exists('max_slides', $patch)
                ? max(1, min(10, (int) $patch['max_slides']))
                : $current['max_slides'],
        ];

        SystemSetting::query()->updateOrCreate(
            ['key' => self::SETTING_KEY],
            ['value' => $next, 'group' => 'advertising'],
        );

        return $next;
    }

    /** @return array{enabled: bool, placement: string, autoplay_seconds: int, max_slides: int} */
    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'placement' => 'events',
            'autoplay_seconds' => 10,
            'max_slides' => 5,
        ];
    }
}
