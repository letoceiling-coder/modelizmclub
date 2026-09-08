<?php

namespace App\Support;

final class PaymentAccountingType
{
    public const SUBSCRIPTION = 'subscription';

    public const LISTING = 'listing';

    public const LISTING_BOOST = 'listing_boost';

    public const ESCROW = 'escrow';

    /**
     * Пополнение кошелька.
     *
     * Раньше попадало в «Прочее»: `payable_type = wallet_topup` не был
     * перечислен, и в выгрузке для бухгалтерии пополнения лежали вместе с
     * тем, что классифицировать не удалось. В истории платежей пользователя
     * это видно ещё хуже — «Прочее, 300 ₽» не говорит человеку ничего.
     */
    public const TOPUP = 'topup';

    public const OTHER = 'other';

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            self::SUBSCRIPTION => 'Подписка',
            self::LISTING => 'Размещение объявления',
            self::LISTING_BOOST => 'Поднятие объявления',
            self::ESCROW => 'Безопасная сделка',
            self::TOPUP => 'Пополнение кошелька',
            self::OTHER => 'Прочее',
        ];
    }

    /** @param  array<string, mixed>|null  $metadata */
    public static function resolve(?array $metadata): string
    {
        if (! is_array($metadata)) {
            return self::OTHER;
        }

        $type = $metadata['payable_type'] ?? null;

        if ($type === 'subscription' || ($type === null && isset($metadata['plan_id']))) {
            return self::SUBSCRIPTION;
        }

        return match ($type) {
            'listing_placement' => self::LISTING,
            'listing_boost' => self::LISTING_BOOST,
            'escrow' => self::ESCROW,
            'wallet_topup' => self::TOPUP,
            default => self::OTHER,
        };
    }

    public static function label(string $type): string
    {
        return self::labels()[$type] ?? $type;
    }
}
