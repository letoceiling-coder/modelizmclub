<?php

namespace Database\Seeders;

use App\Models\ListingPricingRule;
use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

/**
 * Seller-cabinet subscription plans — slugs must match frontend pricing.ts:
 * month | half | year.
 */
class SubscriptionPlansSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'slug' => 'month',
                'name' => 'Месяц',
                'description' => 'Подписка на 1 месяц.',
                'price_cents' => 9900,
                'period_days' => 30,
                'sort_order' => 10,
            ],
            [
                'slug' => 'half',
                'name' => 'Полгода',
                'description' => 'Подписка на 6 месяцев.',
                'price_cents' => 49900,
                'period_days' => 180,
                'sort_order' => 20,
            ],
            [
                'slug' => 'year',
                'name' => 'Год',
                'description' => 'Подписка на 12 месяцев.',
                'price_cents' => 79900,
                'period_days' => 365,
                'sort_order' => 30,
            ],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::query()->updateOrCreate(
                ['slug' => $plan['slug']],
                array_merge($plan, [
                    'features' => ['posts' => 'unlimited', 'listings' => 'unlimited'],
                    'is_active' => true,
                ]),
            );
        }
    }
}
