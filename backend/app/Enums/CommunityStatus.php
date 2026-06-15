<?php

namespace App\Enums;

enum CommunityStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    case Active = 'active';
    case Blocked = 'blocked';
}
