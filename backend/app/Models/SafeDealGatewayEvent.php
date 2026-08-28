<?php

namespace App\Models;

use App\Enums\SafeDealGatewayContour;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Raw VTB callback / notification for a safe-deal charge or payout.
 */
class SafeDealGatewayEvent extends Model
{
    use HasPublicUuid;

    public const TYPE_RBS_CALLBACK = 'rbs_callback';

    public const TYPE_SBP_AUTHORIZE = 'SBP_B2C_PAYMENT_AUTHORIZE';

    public const TYPE_SBP_FINAL = 'SBP_B2C_PAYMENT_FINAL';

    public const TYPE_TRANSFER_RESPONSE = 'TransferResponse';

    protected $fillable = [
        'uuid',
        'contour',
        'event_type',
        'safe_deal_id',
        'incoming_payment_id',
        'payout_id',
        'idempotency_key',
        'payload',
        'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'contour' => SafeDealGatewayContour::class,
            'payload' => 'array',
            'processed_at' => 'datetime',
        ];
    }

    public function safeDeal(): BelongsTo
    {
        return $this->belongsTo(SafeDeal::class);
    }

    public function incomingPayment(): BelongsTo
    {
        return $this->belongsTo(SafeDealIncomingPayment::class, 'incoming_payment_id');
    }

    public function payout(): BelongsTo
    {
        return $this->belongsTo(SafeDealPayout::class, 'payout_id');
    }
}
