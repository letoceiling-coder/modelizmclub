<?php

namespace App\Enums;

enum PhoneVerificationPhase: string
{
    case AwaitingPush = 'awaiting_push';
    case OtpRequired = 'otp_required';
    case AwaitingSms = 'awaiting_sms';
    case Delivered = 'delivered';
    case Failed = 'failed';
}
