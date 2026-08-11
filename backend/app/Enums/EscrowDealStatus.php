<?php

namespace App\Enums;

enum EscrowDealStatus: string
{
    case PendingPayment = 'pending_payment';
    /** Hold active (VTB preAuth) — ЮKassa uses {@see Paid} after capture-at-payment. */
    case Funded = 'funded';
    case Paid = 'paid';
    case AwaitingShipment = 'awaiting_shipment';
    case InTransit = 'in_transit';
    case Delivered = 'delivered';
    case AwaitingBuyerConfirm = 'awaiting_buyer_confirm';
    case Captured = 'captured';
    case PayoutPending = 'payout_pending';
    case Completed = 'completed';
    case DisputeOpen = 'dispute_open';
    case Frozen = 'frozen';
    case Refunding = 'refunding';
    case Refunded = 'refunded';
    case Reversed = 'reversed';
    case Cancelled = 'cancelled';
    case Failed = 'failed';

    public function isTerminal(): bool
    {
        return in_array($this, [
            self::Completed,
            self::Refunded,
            self::Reversed,
            self::Cancelled,
            self::Failed,
        ], true);
    }

    public function allowsCapture(): bool
    {
        return in_array($this, [
            self::Funded,
            self::Paid,
            self::AwaitingBuyerConfirm,
            self::Delivered,
            self::DisputeOpen,
        ], true);
    }
}
