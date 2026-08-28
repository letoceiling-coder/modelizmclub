<?php

namespace App\Enums;

/**
 * Incoming VTB internet acquiring (RBS / ИЭ) payment for a safe deal.
 *
 * Maps register.do / getOrderStatusExtended.do orderStatus:
 * 0 registered → Pending, 1 authorized → Authorized (card hold, two-stage),
 * 2 deposited → Captured, 3 reversed → Reversed, 4 refunded → Refunded,
 * 6 declined → Failed. There is no VTB nominal account — captured funds
 * sit on the merchant settlement account; our wallet ledger still holds them.
 */
enum SafeDealIncomingStatus: string
{
    case Pending = 'pending';
    case Authorized = 'authorized';
    case Captured = 'captured';
    case Reversed = 'reversed';
    case Refunded = 'refunded';
    case Failed = 'failed';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Captured, self::Reversed, self::Refunded, self::Failed], true);
    }

    public function fundsOnSettlementAccount(): bool
    {
        return $this === self::Captured;
    }

    public static function fromRbsOrderStatus(?int $orderStatus): self
    {
        return match ($orderStatus) {
            1 => self::Authorized,
            2 => self::Captured,
            3 => self::Reversed,
            4 => self::Refunded,
            6 => self::Failed,
            default => self::Pending,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Ожидает оплату',
            self::Authorized => 'Авторизована (холд на карте)',
            self::Captured => 'Зачислена на расчётный счёт',
            self::Reversed => 'Отменена (reverse)',
            self::Refunded => 'Возврат',
            self::Failed => 'Отклонена',
        };
    }
}
