<?php

namespace Modules\Delivery\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ShipmentEvent */
class ShipmentEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'status' => $this->status,
            'provider_status' => $this->provider_status,
            'message' => $this->message,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
        ];
    }
}
