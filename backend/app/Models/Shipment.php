<?php

namespace App\Models;

use App\Enums\DeliveryCarrier;
use App\Enums\ShipmentStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shipment extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'listing_id',
        'conversation_id',
        'seller_id',
        'buyer_id',
        'provider',
        'status',
        'seller_point_id',
        'source_point',
        'destination_point',
        'weight_kg',
        'dimensions_cm',
        'delivery_cost_cents',
        'currency',
        'tracking_number',
        'external_id',
        'external_status',
        'quoted_at',
        'created_at_provider',
        'delivered_at',
        'cancelled_at',
        'raw_payload',
        'error_message',
        'admin_note',
    ];

    protected function casts(): array
    {
        return [
            'provider' => DeliveryCarrier::class,
            'status' => ShipmentStatus::class,
            'source_point' => 'array',
            'destination_point' => 'array',
            'dimensions_cm' => 'array',
            'raw_payload' => 'array',
            'weight_kg' => 'decimal:3',
            'quoted_at' => 'datetime',
            'created_at_provider' => 'datetime',
            'delivered_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function sellerPoint(): BelongsTo
    {
        return $this->belongsTo(SellerDeliveryProfile::class, 'seller_point_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(ShipmentEvent::class)->orderByDesc('occurred_at');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(DeliveryQuote::class);
    }

    public function isParticipant(User $user): bool
    {
        return $this->seller_id === $user->id || $this->buyer_id === $user->id;
    }
}
