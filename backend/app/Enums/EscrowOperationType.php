<?php

namespace App\Enums;

enum EscrowOperationType: string
{
    case Sync = 'sync';
    case Capture = 'capture';
    case Reverse = 'reverse';
    case Refund = 'refund';
    case Payout = 'payout';
    case Freeze = 'freeze';
    case Unfreeze = 'unfreeze';
    case Cancel = 'cancel';
    case DisputeOpen = 'dispute_open';
    case DisputeResolve = 'dispute_resolve';
}
