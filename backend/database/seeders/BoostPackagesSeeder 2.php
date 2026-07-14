<?php

namespace Database\Seeders;

use App\Models\ListingPricingRule;
use Illuminate\Database\Seeder;

/**
 * Boost packages — ids must match frontend config/boost.ts placeholders.
 */
class BoostPackagesSeeder extends Seeder
{
    public function run(): void
    {
        $packages = [
            ['package_id' => 'boost-7', 'label' => '7 дней', 'days' => 7, 'price_cents' => 14900],
            ['package_id' => 'boost-14', 'label' => '14 дней', 'days' => 14, 'price_cents' => 24900],
            ['package_id' => 'boost-30', 'label' => '30 дней', 'days' => 30, 'price_cents' => 39900],
        ];

        foreach ($packages as $package) {
            ListingPricingRule::query()->updateOrCreate(
                [
                    'category_id' => null,
                    'duration_days' => $package['days'],
                ],
                [
                    'base_price_cents' => $package['price_cents'],
                    'max_active_listings_free' => 0,
                    'settings' => [
                        'type' => 'boost',
                        'package_id' => $package['package_id'],
                        'label' => $package['label'],
                    ],
                ],
            );
        }
    }
}
