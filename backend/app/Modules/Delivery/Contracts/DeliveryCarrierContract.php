<?php

namespace Modules\Delivery\Contracts;

use App\Enums\DeliveryCarrier;
use App\Enums\ShipmentStatus;
use App\Models\Shipment;

interface DeliveryCarrierContract
{
    public function carrier(): DeliveryCarrier;

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    public function listPickupPoints(array $filters): array;

    /**
     * @param  array<string, mixed>  $source
     * @param  array<string, mixed>  $destination
     * @param  array<string, mixed>  $parcel  weight_kg, dimensions_cm
     * @return array{price_cents:int,tariff_code:?string,currency:string,raw:array}
     */
    public function quote(array $source, array $destination, array $parcel): array;

    /**
     * @return array{external_id:?string,tracking_number:?string,external_status:?string,raw:array}
     */
    public function createShipment(Shipment $shipment): array;

    /**
     * @return array{external_status:?string,tracking_number:?string,raw:array}
     */
    public function fetchStatus(Shipment $shipment): array;

    /**
     * Снять заказ у перевозчика.
     *
     * До 22.09 отмены в контракте не было вовсе: `ShipmentService::cancel`
     * менял статус только у нас, а заказ у перевозчика оставался живым —
     * посылку можно было сдать, и доставку бы посчитали. Проверено на
     * учебном контуре СДЭК: `DELETE /v2/orders/{uuid}` отвечает 202.
     *
     * @return array<string, mixed> сырой ответ перевозчика — в `raw_payload`
     */
    public function cancelShipment(Shipment $shipment): array;

    public function mapProviderStatus(string $status): ?ShipmentStatus;
}
