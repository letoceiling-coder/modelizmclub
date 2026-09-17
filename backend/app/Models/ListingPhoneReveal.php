<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Одно раскрытие номера продавца. Пишет SellerPhoneRevealService.
 */
class ListingPhoneReveal extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'listing_id',
        'viewer_id',
        'seller_id',
        'provider',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class)->withTrashed();
    }

    public function viewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'viewer_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }
}
