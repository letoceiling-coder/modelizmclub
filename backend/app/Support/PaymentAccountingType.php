<?php

namespace App\Support;

final class PaymentAccountingType
{
    public const SUBSCRIPTION = 'subscription';

    public const LISTING = 'listing';

    public const LISTING_BOOST = 'listing_boost';

    public const ESCROW = 'escrow';

    public const OTHER = 'other';

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            self::SUBSCRIPTION => 'Подписка',
            self::LISTING => 'Размещение объявления',
            self::LISTING_BOOST => 'Поднятие объявления',
            self::ESCROW => 'Безопасная сделка',
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
            default => self::OTHER,
        };
    }

    public static function label(string $type): string
    {
        return self::labels()[$type] ?? $type;
    }
}
