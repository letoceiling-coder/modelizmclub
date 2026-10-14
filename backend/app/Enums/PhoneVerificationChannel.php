<?php

namespace App\Enums;

enum PhoneVerificationChannel: string
{
    case Classic = 'classic';
    case MobileId = 'mobile_id';
}
