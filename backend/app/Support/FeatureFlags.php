<?php

namespace App\Support;

use App\Models\SystemSetting;

class FeatureFlags
{
    public static function enabled(string $key, bool $default = false): bool
    {
        $value = SystemSetting::query()->where('key', $key)->value('value');

        if (! is_array($value)) {
            return $default;
        }

        return (bool) ($value['enabled'] ?? $default);
    }
}
