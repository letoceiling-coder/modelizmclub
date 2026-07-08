<?php

namespace Modules\Delivery\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SellerDeliveryProfile */
class SellerDeliveryProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'provider' => $this->provider->value,
            'point_type' => $this->point_type->value,
            'external_point_id' => $this->external_point_id,
            'label' => $this->label,
            'address' => $this->address,
            'city_id' => $this->city_id,
            'is_default' => $this->is_default,
            'is_active' => $this->is_active,
            'meta' => $this->meta,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
