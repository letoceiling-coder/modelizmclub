<?php

namespace App\Models;

use App\Enums\SafeDealPayoutChannel;
use App\Enums\SafeDealPayoutStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Merchant → seller payout for a completed safe deal (VTB ОЭ).
 * SBP B2C (phone + bankId) or card A2C (encrypted PAN, only last4 stored).
 */
class SafeDealPayout extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'safe_deal_id',
        'seller_id',
        'channel',
        'status',
        'amount_kopecks',
        'commission_kopecks',
        'currency',
        'request_id',
        'operation_id',
        'provider_order_id',
        'provider_order_code',
        'bank_status',
        'payment_purpose',
        'sbp_phone',
        'sbp_bank_id',
        'sbp_full_name',
        'sbp_pam',
        'card_last4',
        'nspk_response_code',
        'nspk_response_message',
        'decline_reason',
        'approved_at',
        'confirmed_at',
        'paid_at',
        'declined_at',
        'last_callback_at',
        'metadata',
    ];

    protected $hidden = [
        'sbp_phone',
        'sbp_pam',
    ];

    protected function casts(): array
    {
        return [
            'channel' => SafeDealPayoutChannel::class,
            'status' => SafeDealPayoutStatus::class,
            'amount_kopecks' => 'integer',
            'commission_kopecks' => 'integer',
            'sbp_phone' => 'encrypted',
            'sbp_pam' => 'encrypted',
            'metadata' => 'array',
            'approved_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'paid_at' => 'datetime',
            'declined_at' => 'datetime',
            'last_callback_at' => 'datetime',
        ];
    }

    public function safeDeal(): BelongsTo
    {
        return $this->belongsTo(SafeDeal::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function gatewayEvents(): HasMany
    {
        return $this->hasMany(SafeDealGatewayEvent::class, 'payout_id');
    }

    public function applyBankStatus(?string $bankStatus): void
    {
        $status = SafeDealPayoutStatus::fromBankStatus($bankStatus);
        $now = now();

        $this->bank_status = $bankStatus ? strtoupper($bankStatus) : $this->bank_status;
        $this->status = $status;
        $this->last_callback_at = $now;

        match ($status) {
            SafeDealPayoutStatus::Approved => $this->approved_at ??= $now,
            SafeDealPayoutStatus::Confirmed => $this->confirmed_at ??= $now,
            SafeDealPayoutStatus::Paid => $this->paid_at ??= $now,
            SafeDealPayoutStatus::Declined => $this->declined_at ??= $now,
            default => null,
        };
    }
}
