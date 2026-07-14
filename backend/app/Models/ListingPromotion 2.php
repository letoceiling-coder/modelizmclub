<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ListingPromotion extends Model
{
    protected $fillable = [
        'listing_id',
        'type',
        'paid_until',
    ];

    protected function casts(): array
    {
        return [
            'paid_until' => 'datetime',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
