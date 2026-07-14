<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class FeatureFlagsSeeder extends Seeder
{
    public function run(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.communities_enabled'],
            ['value' => ['enabled' => false], 'group' => 'features'],
        );
    }
}
