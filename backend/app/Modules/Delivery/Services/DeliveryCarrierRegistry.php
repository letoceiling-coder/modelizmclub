<?php

namespace Modules\Delivery\Services;

use App\Enums\DeliveryCarrier;
use Modules\Delivery\Contracts\DeliveryCarrierContract;
use Modules\Delivery\Services\Carriers\CdekDeliveryAdapter;
use Modules\Delivery\Services\Carriers\YandexDeliveryAdapter;
use RuntimeException;

class DeliveryCarrierRegistry
{
    public function __construct(
        private readonly CdekDeliveryAdapter $cdek,
        private readonly YandexDeliveryAdapter $yandex,
    ) {}

    public function get(DeliveryCarrier|string $carrier): DeliveryCarrierContract
    {
        $value = $carrier instanceof DeliveryCarrier ? $carrier : DeliveryCarrier::from($carrier);

        return match ($value) {
            DeliveryCarrier::Cdek => $this->cdek,
            DeliveryCarrier::Yandex => $this->yandex,
        };
    }

    public function assertEnabled(DeliveryCarrier|string $carrier): void
    {
        $value = $carrier instanceof DeliveryCarrier ? $carrier : DeliveryCarrier::from($carrier);

        $enabled = match ($value) {
            DeliveryCarrier::Cdek => (bool) config('cdek.enabled'),
            DeliveryCarrier::Yandex => (bool) config('yandex-delivery.enabled'),
        };

        if (! $enabled) {
            throw new RuntimeException('Delivery provider '.$value->value.' is disabled.');
        }
    }
}
