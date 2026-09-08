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

    /**
     * Подпись статуса.
     *
     * `$holdsOnCard` — единственное, что нельзя вывести из самого статуса:
     * «оплачена» значит разное в двух режимах эквайринга. При двухстадийном
     * деньги правда лежат на карте покупателя и площадка их не получала; при
     * одностадийном они уже списаны на её счёт. Написать про холд во втором
     * случае — сказать покупателю неправду о том, где его деньги, и это
     * расхождение правовое, а не косметическое: на текст ссылается оферта.
     *
     * `null` — режим неизвестен вызывающему; тогда подпись нейтральна и не
     * утверждает ничего лишнего.
     */
    public function label(?bool $holdsOnCard = null): string
    {
        return match ($this) {
            self::Created => 'Создана',
            self::Paid => match ($holdsOnCard) {
                true => 'Оплачена (в холде)',
                false => 'Оплачена, деньги у площадки',
                null => 'Оплачена',
            },
            self::Shipped => 'Отправлена',
            self::Delivered => 'Доставлена',
            self::Completed => 'Завершена',
            self::Disputed => 'Спор',
            self::Refunded => 'Возврат',
            self::Cancelled => 'Отменена',
        };
    }
}
