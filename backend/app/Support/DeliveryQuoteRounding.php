<?php

namespace App\Support;

final class DeliveryQuoteRounding
{
    /**
     * Round delivery up to 50 ₽ below 500 ₽, otherwise to 100 ₽.
     */
    public static function roundKopecks(int $kopecks): int
    {
        $rub = max(0, $kopecks) / 100;
        $step = $rub < 500 ? 50.0 : 100.0;
        $rounded = (int) ceil($rub / $step) * (int) $step;

        return $rounded * 100;
    }
}
