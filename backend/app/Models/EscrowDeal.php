<?php

namespace App\Models;

use App\Enums\EscrowDealStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EscrowDeal extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'listing_id',
        'buyer_id',
        'seller_id',
        'amount_cents',
        'item_amount_cents',
        'delivery_amount_cents',
        'seller_payout_cents',
        'platform_fee_cents',
        'captured_cents',
        'refunded_cents',
        'paid_out_cents',
        'currency',
        'status',
        'payment_provider',
        'yookassa_deal_id',
        'yookassa_payment_id',
        'yookassa_payout_id',
        'vtb_order_id',
        'vtb_payment_state',
        'payment_id',
        'shipment_id',
        'paid_at',
        'completed_at',
        'frozen_at',
        'freeze_reason',
        'dispute_status',
        'admin_note',
        'metadata',
        'fee_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'status' => EscrowDealStatus::class,
            'paid_at' => 'datetime',
            'completed_at' => 'datetime',
            'frozen_at' => 'datetime',
            'metadata' => 'array',
            'fee_snapshot' => 'array',
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

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    public function operations(): HasMany
    {
        return $this->hasMany(EscrowOperation::class)->orderByDesc('created_at');
    }

    public function isFrozen(): bool
    {
        return $this->frozen_at !== null
            || $this->status === EscrowDealStatus::Frozen
            || $this->dispute_status === 'open';
    }

    public function remainingCaptureCents(): int
    {
        $held = $this->amount_cents - $this->captured_cents - $this->refunded_cents;

        return max(0, $held);
    }

    public function remainingPayoutCents(): int
    {
        return max(0, $this->captured_cents - $this->refunded_cents - $this->paid_out_cents);
    }
}
