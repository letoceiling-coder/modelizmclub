<?php

namespace App\Enums;

enum DisputeStatus: string
{
    case Open = 'open';
    case ResolvedBuyer = 'resolved_buyer';
    case ResolvedSeller = 'resolved_seller';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Открыт',
            self::ResolvedBuyer => 'Решён в пользу покупателя',
            self::ResolvedSeller => 'Решён в пользу продавца',
            self::Cancelled => 'Отменён',
        };
    }
}
