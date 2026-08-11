<?php

namespace App\Enums;

enum EscrowOperationStatus: string
{
    case Pending = 'pending';
    case Success = 'success';
    case Failed = 'failed';
}
