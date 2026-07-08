<?php

namespace App\Models;

use App\Enums\DeliveryCarrier;
use App\Enums\DeliveryPointType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerDeliveryProfile extends Model
{
    protected $fillable = [
        'user_id',
        'provider',
        'point_type',
        'external_point_id',
        'label',
        'address',
        'city_id',
        'is_default',
        'is_active',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'provider' => DeliveryCarrier::class,
            'point_type' => DeliveryPointType::class,
            'address' => 'array',
            'meta' => 'array',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function toPointSnapshot(): array
    {
        $cityCode = $this->meta['city_code']
            ?? $this->address['city_code']
            ?? null;

        return array_filter([
            'provider' => $this->provider->value,
            'point_type' => $this->point_type->value,
            'external_point_id' => $this->external_point_id,
            'label' => $this->label,
            'address' => $this->address,
            'city_id' => $this->city_id,
            'city_code' => $cityCode,
            'meta' => $this->meta,
        ], fn ($value) => $value !== null);
    }
}
