<?php

use App\Models\SystemSetting;
use App\Support\FeedGuestAccessRegistry;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => FeedGuestAccessRegistry::SETTING_KEY],
            ['value' => FeedGuestAccessRegistry::defaultConfig(), 'group' => 'feed'],
        );
    }

    public function down(): void
    {
        SystemSetting::query()->where('key', FeedGuestAccessRegistry::SETTING_KEY)->delete();
    }
};
