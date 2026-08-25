<?php

namespace Modules\Admin\Services;

use App\Models\SystemSetting;
use App\Support\NotificationPolicyRegistry;

class NotificationPolicySettingsService
{
    /** @return array<string, mixed> */
    public function mergedConfig(): array
    {
        $defaults = NotificationPolicyRegistry::defaultConfig();
        $row = SystemSetting::query()->where('key', NotificationPolicyRegistry::SETTING_KEY)->first();
        $stored = is_array($row?->value) ? $row->value : [];
        $storedTypes = is_array($stored['types'] ?? null) ? $stored['types'] : [];

        $types = [];
        foreach (NotificationPolicyRegistry::types() as $meta) {
            $key = $meta['key'];
            $patch = is_array($storedTypes[$key] ?? null) ? $storedTypes[$key] : [];
            $types[$key] = NotificationPolicyRegistry::normalizeType($patch, $meta);
        }

        return [
            'version' => 1,
            'types' => $types,
        ];
    }

    /** @return array<string, mixed> */
    public function adminPayload(): array
    {
        return [
            'config' => $this->mergedConfig(),
            'registry' => NotificationPolicyRegistry::types(),
            'group_labels' => NotificationPolicyRegistry::groupLabels(),
        ];
    }

    /** @param  array<string, mixed>  $payload */
    public function update(array $payload): array
    {
        $incoming = is_array($payload['types'] ?? null) ? $payload['types'] : [];
        $types = [];
        foreach (NotificationPolicyRegistry::types() as $meta) {
            $key = $meta['key'];
            $patch = is_array($incoming[$key] ?? null) ? $incoming[$key] : [];
            $types[$key] = NotificationPolicyRegistry::normalizeType($patch, $meta);
        }

        $stored = [
            'version' => 1,
            'types' => $types,
        ];

        SystemSetting::query()->updateOrCreate(
            ['key' => NotificationPolicyRegistry::SETTING_KEY],
            ['value' => $stored, 'group' => 'notifications'],
        );

        return $this->mergedConfig();
    }
}
