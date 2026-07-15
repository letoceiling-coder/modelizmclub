<?php

namespace App\Models;

use App\Enums\EscrowDealStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EscrowDeal extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'listing_id',
        'buyer_id',
        'seller_id',
        'amount_cents',
        'seller_payout_cents',
        'platform_fee_cents',
        'currency',
        'status',
        'yookassa_deal_id',
        'yookassa_payment_id',
        'yookassa_payout_id',
        'payment_id',
        'paid_at',
        'completed_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'status' => EscrowDealStatus::class,
            'paid_at' => 'datetime',
            'completed_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
