<?php

namespace App\Enums;

/**
 * Seller payout via VTB Open API (ОЭ).
 *
 * SBP B2C (docx 1.2.0): NEW/PROCESSING → APPROVED → confirm → CONFIRMED → PAID | DECLINED.
 * Card A2C (gateway 1.0.6): POST account-to-card → TransferResponse callback.
 */
enum SafeDealPayoutStatus: string
{
    case Created = 'created';
    case Processing = 'processing';
    case Approved = 'approved';
    case Confirmed = 'confirmed';
    case Paid = 'paid';
    case Declined = 'declined';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Paid, self::Declined], true);
    }

    public function canConfirm(): bool
    {
        return $this === self::Approved;
    }

    public static function fromBankStatus(?string $status): self
    {
        return match (strtoupper((string) $status)) {
            'NEW', 'PROCESSING' => self::Processing,
            'APPROVED' => self::Approved,
            'CONFIRMED' => self::Confirmed,
            'PAID', 'SUCCESS', 'COMPLETED' => self::Paid,
            'DECLINED', 'FAIL', 'FAILED', 'ERROR' => self::Declined,
            default => self::Created,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Created => 'Создана',
            self::Processing => 'Проверка в процессинге',
            self::Approved => 'Можно подтвердить',
            self::Confirmed => 'Подтверждена, ждём зачисление',
            self::Paid => 'Выплачена',
            self::Declined => 'Отклонена',
        };
    }
}
