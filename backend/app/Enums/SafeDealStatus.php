<?php

namespace App\Enums;

/**
 * Wallet-based safe deal (escrow) state machine (spec v4.0 §T5).
 *
 * created → paid → shipped → delivered → completed
 *                                     ↘ disputed → refunded | completed
 *         ↘ cancelled (refund buyer)
 */
enum SafeDealStatus: string
{
    case Created = 'created';
    case Paid = 'paid';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
    case Completed = 'completed';
    case Disputed = 'disputed';
    case Refunded = 'refunded';
    case Cancelled = 'cancelled';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Refunded, self::Cancelled], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Created => 'Создана',
            self::Paid => 'Оплачена (в холде)',
            self::Shipped => 'Отправлена',
            self::Delivered => 'Доставлена',
            self::Completed => 'Завершена',
            self::Disputed => 'Спор',
            self::Refunded => 'Возврат',
            self::Cancelled => 'Отменена',
        };
    }
}
