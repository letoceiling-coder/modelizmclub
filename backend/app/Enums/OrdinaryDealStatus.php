<?php

namespace App\Enums;

enum OrdinaryDealStatus: string
{
    case Active = 'active';
    /** Покупатель ответил «Я не покупал». */
    case Declined = 'declined';
    /** Продавец снял отметку о продаже. */
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Продано',
            self::Declined => 'Покупатель не подтвердил',
            self::Cancelled => 'Отметка снята',
        };
    }
}
