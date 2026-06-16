<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'description',
        'price_cents',
        'period_days',
        'features',
        'max_photos_per_post',
        'free_listings_per_month',
        'listing_discount_percent',
        'priority_boost',
        'badge_label',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'features' => 'array',
            'priority_boost' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
