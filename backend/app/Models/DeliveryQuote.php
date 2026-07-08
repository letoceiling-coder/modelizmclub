<?php

namespace App\Models;

use App\Enums\DeliveryCarrier;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryQuote extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'shipment_id',
        'provider',
        'source_point',
        'destination_point',
        'parcels',
        'price_cents',
        'tariff_code',
        'currency',
        'expires_at',
        'raw_payload',
    ];

    protected function casts(): array
    {
        return [
            'provider' => DeliveryCarrier::class,
            'source_point' => 'array',
            'destination_point' => 'array',
            'parcels' => 'array',
            'raw_payload' => 'array',
            'expires_at' => 'datetime',
        ];
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
