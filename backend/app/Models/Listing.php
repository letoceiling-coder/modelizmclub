<?php

namespace App\Models;

use App\Enums\ListingStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
        'contact_via_messenger',
        'views_count',
        'favorites_count',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ListingStatus::class,
            'delivery_methods' => 'array',
            'contact_via_messenger' => 'boolean',
            'published_at' => 'datetime',
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
}
