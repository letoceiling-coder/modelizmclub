<?php

namespace App\Enums;

enum DeliveryPointType: string
{
    case Warehouse = 'warehouse';
    case PickupPoint = 'pickup_point';
}
