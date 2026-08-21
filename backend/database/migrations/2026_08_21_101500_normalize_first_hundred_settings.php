<?php

use App\Models\SystemSetting;
use App\Support\FirstHundredPromo;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $setting = SystemSetting::query()->firstOrCreate(
            ['key' => FirstHundredPromo::SETTING_KEY],
            ['value' => FirstHundredPromo::defaults(), 'group' => 'marketing'],
        );

        $normalized = FirstHundredPromo::normalize($setting->value);
        $normalized['enabled'] = false;

        $setting->forceFill([
            'value' => $normalized,
            'group' => $setting->group ?: 'marketing',
        ])->save();
    }

    public function down(): void
    {
        // Keep the setting; only the normalized shape is written.
    }
};
