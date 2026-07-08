<?php

namespace App\Enums;

enum ShipmentStatus: string
{
    case Draft = 'draft';
    case Quoted = 'quoted';
    case AwaitingSeller = 'awaiting_seller';
    case Creating = 'creating';
    case Created = 'created';
    case Accepted = 'accepted';
    case InTransit = 'in_transit';
    case AtPickup = 'at_pickup';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';
    case Error = 'error';
}
