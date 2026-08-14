<?php

namespace App\Enums;

enum DeliveryCarrier: string
{
    case Cdek = 'cdek';
    case Yandex = 'yandex';
    case Pochta = 'pochta';
    case Ozon = 'ozon';

    public function isIntegrated(): bool
    {
        return match ($this) {
            self::Cdek, self::Yandex => true,
            self::Pochta, self::Ozon => false,
        };
    }

    public function listingLabel(): string
    {
        return match ($this) {
            self::Cdek => 'СДЭК',
            self::Yandex => 'Яндекс Доставка',
            self::Pochta => 'Почта России',
            self::Ozon => 'Ozon',
        };
    }
}
