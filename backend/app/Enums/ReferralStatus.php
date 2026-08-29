<?php

namespace App\Enums;

enum ReferralStatus: string
{
    case Pending = 'pending';
    case Completed = 'completed';
}
