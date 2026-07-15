<?php

namespace App\Enums;

enum EscrowDealStatus: string
{
    case PendingPayment = 'pending_payment';
    case Paid = 'paid';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case Failed = 'failed';
}
