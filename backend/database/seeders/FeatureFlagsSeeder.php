<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class FeatureFlagsSeeder extends Seeder
{
    public function run(): void
    {
        SystemSetting::query()->firstOrCreate(
            ['key' => 'feature.communities_enabled'],
            ['value' => ['enabled' => false], 'group' => 'features'],
        );

        SystemSetting::query()->firstOrCreate(
            ['key' => 'feature.listing_payment_enabled'],
            ['value' => ['enabled' => true], 'group' => 'feature'],
        );

        SystemSetting::query()->firstOrCreate(
            ['key' => 'feature.reviews_enabled'],
            ['value' => ['enabled' => true], 'group' => 'features'],
        );
    }
}
