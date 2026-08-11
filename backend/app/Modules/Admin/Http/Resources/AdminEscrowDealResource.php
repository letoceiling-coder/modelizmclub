<?php

namespace Modules\Admin\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\EscrowDeal */
class AdminEscrowDealResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $listing = $this->listing;
        $shipment = $this->shipment;
        $buyer = $this->buyer;
        $seller = $this->seller;

        return [
            'uuid' => $this->uuid,
            'status' => $this->status->value,
            'dispute_status' => $this->dispute_status,
            'frozen' => $this->isFrozen(),
            'frozen_at' => $this->frozen_at?->toIso8601String(),
            'freeze_reason' => $this->freeze_reason,
            'admin_note' => $this->admin_note,
            'payment_provider' => $this->payment_provider,
            'vtb_order_id' => $this->vtb_order_id,
            'vtb_payment_state' => $this->vtb_payment_state,
            'amount_cents' => $this->amount_cents,
            'item_amount_cents' => $this->item_amount_cents ?? $this->amount_cents,
            'delivery_amount_cents' => $this->delivery_amount_cents,
            'platform_fee_cents' => $this->platform_fee_cents,
            'seller_payout_cents' => $this->seller_payout_cents,
            'captured_cents' => $this->captured_cents,
            'refunded_cents' => $this->refunded_cents,
            'paid_out_cents' => $this->paid_out_cents,
            'currency' => $this->currency,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'listing' => $listing ? [
                'uuid' => $listing->uuid,
                'title' => $listing->title,
                'slug' => $listing->slug,
                'price_cents' => $listing->price_cents,
            ] : null,
            'buyer' => $buyer ? [
                'id' => $buyer->id,
                'email' => $buyer->email,
                'display_name' => $buyer->profile?->display_name,
                'slug' => $buyer->profile?->slug,
            ] : null,
            'seller' => $seller ? [
                'id' => $seller->id,
                'email' => $seller->email,
                'display_name' => $seller->profile?->display_name,
                'slug' => $seller->profile?->slug,
            ] : null,
            'shipment' => $shipment ? [
                'uuid' => $shipment->uuid,
                'provider' => $shipment->provider?->value ?? $shipment->provider,
                'status' => $shipment->status?->value ?? $shipment->status,
                'tracking_number' => $shipment->tracking_number,
                'delivery_cost_cents' => $shipment->delivery_cost_cents,
                'source_point' => $shipment->source_point,
                'destination_point' => $shipment->destination_point,
                'delivered_at' => $shipment->delivered_at?->toIso8601String(),
                'events' => $this->whenLoaded('shipment', fn () => $shipment->relationLoaded('events')
                    ? $shipment->events->map(fn ($e) => [
                        'status' => $e->status?->value ?? $e->status,
                        'message' => $e->message,
                        'occurred_at' => $e->occurred_at?->toIso8601String(),
                    ])->all()
                    : []),
            ] : null,
            'payment' => $this->payment ? [
                'uuid' => $this->payment->uuid,
                'provider' => $this->payment->provider,
                'status' => $this->payment->status,
                'provider_payment_id' => $this->payment->provider_payment_id,
            ] : null,
            'operations' => $this->whenLoaded('operations', fn () => $this->operations->map(fn ($op) => [
                'id' => $op->id,
                'type' => $op->type->value,
                'status' => $op->status->value,
                'amount_cents' => $op->amount_cents,
                'provider' => $op->provider,
                'provider_reference' => $op->provider_reference,
                'initiated_by' => $op->initiated_by,
                'admin_user_id' => $op->admin_user_id,
                'reason' => $op->reason,
                'error_message' => $op->error_message,
                'created_at' => $op->created_at?->toIso8601String(),
            ])),
        ];
    }
}
