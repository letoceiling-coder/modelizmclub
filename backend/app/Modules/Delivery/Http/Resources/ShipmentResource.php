<?php

namespace Modules\Delivery\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Listing\Http\Resources\ListingResource;

/** @mixin \App\Models\Shipment */
class ShipmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'provider' => $this->provider->value,
            'status' => $this->status->value,
            'listing' => new ListingResource($this->whenLoaded('listing')),
            'listing_id' => $this->listing_id,
            'conversation_id' => $this->conversation_id,
            'seller_id' => $this->seller_id,
            'buyer_id' => $this->buyer_id,
            'seller_point_id' => $this->seller_point_id,
            'source_point' => $this->source_point,
            'destination_point' => $this->destination_point,
            'weight_kg' => $this->weight_kg,
            'dimensions_cm' => $this->dimensions_cm,
            'delivery_cost_cents' => $this->delivery_cost_cents,
            'currency' => $this->currency,
            'tracking_number' => $this->tracking_number,
            'external_id' => $this->external_id,
            'external_status' => $this->external_status,
            'quoted_at' => $this->quoted_at?->toIso8601String(),
            'created_at_provider' => $this->created_at_provider?->toIso8601String(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'error_message' => $this->error_message,
            'events' => ShipmentEventResource::collection($this->whenLoaded('events')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
