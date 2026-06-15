<?php

namespace App\Enums;

enum UserStatus: string
{
    case Active = 'active';
    case Blocked = 'blocked';
    case Deleted = 'deleted';
    case PendingVerification = 'pending_verification';
}
