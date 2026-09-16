<?php

namespace App\Models;

use App\Enums\OrdinaryDealStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Продажа, отмеченная продавцом в переписке. См. миграцию create_ordinary_deals_table. */
class OrdinaryDeal extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'listing_id',
        'seller_id',
        'buyer_id',
        'conversation_id',
        'amount_kopecks',
        'status',
        'declined_at',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => OrdinaryDealStatus::class,
            'amount_kopecks' => 'integer',
            'declined_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class)->withTrashed();
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}
