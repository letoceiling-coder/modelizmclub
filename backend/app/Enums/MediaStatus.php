<?php

namespace App\Enums;

enum MediaStatus: string
{
    case Pending = 'pending';
    case Ready = 'ready';
    case Failed = 'failed';
}
