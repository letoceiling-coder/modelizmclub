<?php

namespace App\Enums;

/** Direct VTB Open API (ОЭ) payout channel — no paykeeper, no nominal account. */
enum SafeDealPayoutChannel: string
{
    case Sbp = 'sbp';
    case Card = 'card';

    public function label(): string
    {
        return match ($this) {
            self::Sbp => 'СБП',
            self::Card => 'Карта (A2C)',
        };
    }
}
