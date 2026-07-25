<?php

namespace Modules\PublicContent\Services;

use App\Models\SystemSetting;
use App\Support\FeedGuestAccessRegistry;

class FeedGuestAccessService
{
    /** @return array<string, mixed> */
    public function publicPayload(): array
    {
        return $this->mergedConfig();
    }

    /** @return array<string, mixed> */
    public function adminPayload(): array
    {
        $config = $this->mergedConfig();

        return [
            'config' => $config,
            'registry' => FeedGuestAccessRegistry::actions(),
            'group_labels' => FeedGuestAccessRegistry::groupLabels(),
        ];
    }

    /** @param array<string, mixed> $payload */
    public function update(array $payload): array
    {
        $defaults = FeedGuestAccessRegistry::defaultConfig();
        $incomingActions = is_array($payload['actions'] ?? null) ? $payload['actions'] : [];

        $actions = [];
        foreach (FeedGuestAccessRegistry::actions() as $row) {
            $key = $row['key'];
            $patch = is_array($incomingActions[$key] ?? null) ? $incomingActions[$key] : [];
            $actions[$key] = [
                'allowed' => array_key_exists('allowed', $patch)
                    ? (bool) $patch['allowed']
                    : ($defaults['actions'][$key]['allowed'] ?? true),
                'deny_mode' => in_array($patch['deny_mode'] ?? 'inherit', ['inherit', 'popup', 'redirect'], true)
                    ? ($patch['deny_mode'] ?? 'inherit')
                    : 'inherit',
            ];
        }

        $stored = [
            'version' => 1,
            'default_deny_mode' => in_array($payload['default_deny_mode'] ?? 'popup', ['popup', 'redirect'], true)
                ? ($payload['default_deny_mode'] ?? 'popup')
                : 'popup',
            'popup' => [
                'title' => trim((string) ($payload['popup']['title'] ?? $defaults['popup']['title'])),
                'description' => trim((string) ($payload['popup']['description'] ?? $defaults['popup']['description'])),
                'primary_cta' => trim((string) ($payload['popup']['primary_cta'] ?? $defaults['popup']['primary_cta'])),
                'secondary_cta' => trim((string) ($payload['popup']['secondary_cta'] ?? $defaults['popup']['secondary_cta'])),
            ],
            'actions' => $actions,
        ];

        SystemSetting::query()->updateOrCreate(
            ['key' => FeedGuestAccessRegistry::SETTING_KEY],
            ['value' => $stored, 'group' => 'feed'],
        );

        return $this->mergedConfig();
    }

    /** @return array<string, mixed> */
    private function mergedConfig(): array
    {
        $defaults = FeedGuestAccessRegistry::defaultConfig();
        $row = SystemSetting::query()->where('key', FeedGuestAccessRegistry::SETTING_KEY)->first();
        $stored = is_array($row?->value) ? $row->value : [];

        $actions = [];
        foreach (FeedGuestAccessRegistry::actions() as $meta) {
            $key = $meta['key'];
            $patch = is_array($stored['actions'][$key] ?? null) ? $stored['actions'][$key] : [];
            $actions[$key] = [
                'allowed' => array_key_exists('allowed', $patch)
                    ? (bool) $patch['allowed']
                    : ($defaults['actions'][$key]['allowed'] ?? true),
                'deny_mode' => in_array($patch['deny_mode'] ?? 'inherit', ['inherit', 'popup', 'redirect'], true)
                    ? ($patch['deny_mode'] ?? 'inherit')
                    : 'inherit',
            ];
        }

        return [
            'version' => 1,
            'default_deny_mode' => in_array($stored['default_deny_mode'] ?? 'popup', ['popup', 'redirect'], true)
                ? ($stored['default_deny_mode'] ?? 'popup')
                : 'popup',
            'popup' => [
                'title' => trim((string) ($stored['popup']['title'] ?? $defaults['popup']['title'])),
                'description' => trim((string) ($stored['popup']['description'] ?? $defaults['popup']['description'])),
                'primary_cta' => trim((string) ($stored['popup']['primary_cta'] ?? $defaults['popup']['primary_cta'])),
                'secondary_cta' => trim((string) ($stored['popup']['secondary_cta'] ?? $defaults['popup']['secondary_cta'])),
            ],
            'actions' => $actions,
        ];
    }
}
