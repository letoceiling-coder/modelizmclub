<?php

namespace App\Models;

use App\Enums\EscrowOperationStatus;
use App\Enums\EscrowOperationType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EscrowOperation extends Model
{
    protected $fillable = [
        'escrow_deal_id',
        'type',
        'amount_cents',
        'currency',
        'status',
        'provider',
        'provider_reference',
        'initiated_by',
        'admin_user_id',
        'idempotency_key',
        'request_payload',
        'response_payload',
        'error_message',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'type' => EscrowOperationType::class,
            'status' => EscrowOperationStatus::class,
            'request_payload' => 'array',
            'response_payload' => 'array',
        ];
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(EscrowDeal::class, 'escrow_deal_id');
    }

    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }
}
