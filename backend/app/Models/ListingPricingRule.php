<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ListingPricingRule extends Model
{
    protected $fillable = [
        'category_id',
        'base_price_cents',
        'duration_days',
        'max_active_listings_free',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ListingCategory::class, 'category_id');
    }

    public function packageId(): ?string
    {
        return $this->settings['package_id'] ?? null;
    }

    public function label(): string
    {
        return $this->settings['label'] ?? "{$this->duration_days} дней";
    }
}
