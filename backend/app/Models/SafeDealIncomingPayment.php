<?php

namespace App\Models;

use App\Enums\SafeDealIncomingStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Buyer → merchant incoming charge for a safe deal (VTB ИЭ / RBS).
 * Captured money lands on the settlement account; there is no nominal account.
 */
class SafeDealIncomingPayment extends Model
{
    use HasPublicUuid;

    public const CAPTURE_ONE_STAGE = 'one_stage';

    public const CAPTURE_TWO_STAGE = 'two_stage';

    protected $fillable = [
        'uuid',
        'safe_deal_id',
        'payment_id',
        'buyer_id',
        'amount_kopecks',
        'currency',
        'status',
        'capture_mode',
        'rbs_order_id',
        'rbs_order_number',
        'rbs_order_status',
        'checkout_url',
        'ofd_receipt_id',
        'ofd_status',
        'ofd_payload',
        'fail_reason',
        'authorized_at',
        'captured_at',
        'reversed_at',
        'refunded_at',
        'failed_at',
        'last_callback_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'status' => SafeDealIncomingStatus::class,
            'amount_kopecks' => 'integer',
            'rbs_order_status' => 'integer',
            'ofd_payload' => 'array',
            'metadata' => 'array',
            'authorized_at' => 'datetime',
            'captured_at' => 'datetime',
            'reversed_at' => 'datetime',
            'refunded_at' => 'datetime',
            'failed_at' => 'datetime',
            'last_callback_at' => 'datetime',
        ];
    }

    public function safeDeal(): BelongsTo
    {
        return $this->belongsTo(SafeDeal::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function gatewayEvents(): HasMany
    {
        return $this->hasMany(SafeDealGatewayEvent::class, 'incoming_payment_id');
    }

    public function applyRbsOrderStatus(?int $orderStatus): void
    {
        $status = SafeDealIncomingStatus::fromRbsOrderStatus($orderStatus);
        $now = now();

        $this->rbs_order_status = $orderStatus;
        $this->status = $status;
        $this->last_callback_at = $now;

        match ($status) {
            SafeDealIncomingStatus::Authorized => $this->authorized_at ??= $now,
            SafeDealIncomingStatus::Captured => $this->captured_at ??= $now,
            SafeDealIncomingStatus::Reversed => $this->reversed_at ??= $now,
            SafeDealIncomingStatus::Refunded => $this->refunded_at ??= $now,
            SafeDealIncomingStatus::Failed => $this->failed_at ??= $now,
            default => null,
        };
    }

    public function isTwoStage(): bool
    {
        return $this->capture_mode === self::CAPTURE_TWO_STAGE;
    }
}
