<?php

namespace App\Models;

use App\Enums\ListingStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Listing extends Model
{
    use HasPublicUuid;
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'user_id',
        'category_id',
        'subcategory_id',
        'title',
        'slug',
        'description',
        'price_cents',
        'currency',
        'city_id',
        'status',
        'rejection_reason',
        'delivery_methods',
        'package_size',
        'weight_kg',
        'dimensions_cm',
        'pickup_address',
        'contact_via_messenger',
        'views_count',
        'favorites_count',
        'published_at',
        'reserved_at',
        'paid_until',
        'placement_payment_id',
        'placement_amount_cents',
        'placement_was_free',
        'placement_promocode_id',
    ];

    protected function casts(): array
    {
        return [
            'status' => ListingStatus::class,
            'delivery_methods' => 'array',
            'dimensions_cm' => 'array',
            'weight_kg' => 'float',
            'contact_via_messenger' => 'boolean',
            'published_at' => 'datetime',
            'reserved_at' => 'datetime',
            'paid_until' => 'datetime',
            'placement_was_free' => 'boolean',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ListingCategory::class, 'category_id');
    }

    public function subcategory(): BelongsTo
    {
        return $this->belongsTo(ListingCategory::class, 'subcategory_id');
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function mediaItems(): HasMany
    {
        return $this->hasMany(ListingMedia::class)->orderBy('sort_order');
    }
}
