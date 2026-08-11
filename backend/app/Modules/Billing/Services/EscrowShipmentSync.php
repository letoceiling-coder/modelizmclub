<?php

namespace Modules\Billing\Services;

use App\Enums\EscrowDealStatus;
use App\Enums\ShipmentStatus;
use App\Models\EscrowDeal;
use App\Models\Shipment;

class EscrowShipmentSync
{
    public function onShipmentUpdated(Shipment $shipment): void
    {
        $deal = EscrowDeal::query()
            ->where('shipment_id', $shipment->id)
            ->whereNotIn('status', [
                EscrowDealStatus::Completed,
                EscrowDealStatus::Cancelled,
                EscrowDealStatus::Reversed,
                EscrowDealStatus::Refunded,
                EscrowDealStatus::Failed,
            ])
            ->first();

        if (! $deal) {
            return;
        }

        $next = match ($shipment->status) {
            ShipmentStatus::Accepted, ShipmentStatus::Created => EscrowDealStatus::AwaitingShipment,
            ShipmentStatus::InTransit, ShipmentStatus::AtPickup => EscrowDealStatus::InTransit,
            ShipmentStatus::Delivered => EscrowDealStatus::AwaitingBuyerConfirm,
            ShipmentStatus::Cancelled => EscrowDealStatus::Cancelled,
            default => null,
        };

        if ($next === null || $deal->status === $next) {
            return;
        }

        if ($deal->status->isTerminal()) {
            return;
        }

        $deal->update(['status' => $next]);
    }
}
