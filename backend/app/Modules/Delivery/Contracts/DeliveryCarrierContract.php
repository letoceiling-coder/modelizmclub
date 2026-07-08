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

    public function mapProviderStatus(string $status): ?ShipmentStatus;
}
