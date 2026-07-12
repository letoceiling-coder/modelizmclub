<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ListingViewDaily extends Model
{
    protected $table = 'listing_view_daily';

    protected $fillable = [
        'listing_id',
        'view_date',
        'views_count',
    ];

    protected function casts(): array
    {
        return [
            'view_date' => 'date',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
