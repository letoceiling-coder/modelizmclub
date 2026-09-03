<?php

namespace App\Enums;

enum ConversationType: string
{
    case Direct = 'direct';
    case Group = 'group';
    case Community = 'community';
    case Room = 'room';
    /** One-per-deal chat between buyer and seller, created with the safe deal. */
    case Deal = 'deal';
}
