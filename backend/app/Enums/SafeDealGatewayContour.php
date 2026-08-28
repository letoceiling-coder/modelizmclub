<?php

namespace App\Enums;

/**
 * VTB callback contours for a safe deal.
 *
 * ИЭ — RBS internet acquiring (sandbox.vtb.ru rest.html#callback-notifications).
 * ОЭ — payment gateway TransferResponse / SBP PAM+final (test-pay.vtb.ru services/callback).
 */
enum SafeDealGatewayContour: string
{
    case Ie = 'ie';
    case Oe = 'oe';

    public function label(): string
    {
        return match ($this) {
            self::Ie => 'Интернет-эквайринг (RBS)',
            self::Oe => 'Платёжный шлюз (выплаты)',
        };
    }
}
