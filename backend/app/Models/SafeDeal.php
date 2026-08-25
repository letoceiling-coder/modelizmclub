<?php

namespace App\Models;

use App\Enums\SafeDealStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SafeDeal extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'listing_id',
        'shipment_id',
        'buyer_id',
        'seller_id',
        'amount_kopecks',
        'platform_fee_kopecks',
        'seller_payout_kopecks',
        'delivery_cost_kopecks',
        'currency',
        'status',
        'hold_transaction_id',
        'payout_transaction_id',
        'refund_transaction_id',
        'delivery_method',
        'destination_point',
        'delivery_status',
        'tracking_number',
        'paid_at',
        'shipped_at',
        'delivered_at',
        'auto_release_at',
        'completed_at',
        'cancelled_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'status' => SafeDealStatus::class,
            'amount_kopecks' => 'integer',
            'platform_fee_kopecks' => 'integer',
            'seller_payout_kopecks' => 'integer',
            'delivery_cost_kopecks' => 'integer',
            'destination_point' => 'array',
            'paid_at' => 'datetime',
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
            'auto_release_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(EscrowTransaction::class);
    }

    public function dispute(): HasOne
    {
        return $this->hasOne(Dispute::class)->latestOfMany();
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(UserReview::class);
    }

    public function involves(User $user): bool
    {
        return (int) $this->buyer_id === (int) $user->id
            || (int) $this->seller_id === (int) $user->id;
    }
}
