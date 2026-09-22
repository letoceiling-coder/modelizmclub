<?php

namespace Modules\Delivery\Services\Carriers;

use App\Enums\DeliveryCarrier;
use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use App\Support\DeliveryPointSnapshot;
use App\Support\DeliveryQuoteRounding;
use Modules\Delivery\Contracts\DeliveryCarrierContract;
use Modules\Delivery\Services\CdekApiExtension;
use RuntimeException;

class CdekDeliveryAdapter implements DeliveryCarrierContract
{
    public function __construct(
        private readonly CdekApiExtension $api,
    ) {}

    public function carrier(): DeliveryCarrier
    {
        return DeliveryCarrier::Cdek;
    }

    public function listPickupPoints(array $filters): array
    {
        $query = array_filter([
            'city_code' => $filters['city_code'] ?? null,
            'type' => $filters['type'] ?? 'PVZ',
            'country_codes' => $filters['country_codes'] ?? 'RU',
        ], fn ($v) => $v !== null && $v !== '');

        $points = $this->api->listDeliveryPoints($query);

        return array_map(fn (array $point): array => [
            'id' => (string) ($point['code'] ?? $point['uuid'] ?? ''),
            'name' => (string) ($point['name'] ?? ''),
            'address' => $point['location']['address_full'] ?? $point['location']['address'] ?? null,
            'city' => $point['location']['city'] ?? null,
            'latitude' => $point['location']['latitude'] ?? null,
            'longitude' => $point['location']['longitude'] ?? null,
            'type' => $point['type'] ?? 'PVZ',
            /*
             * Полный ответ перевозчика наружу не уходит.
             *
             * Он лежал в каждом пункте и никем не читался: ни фронтом (его
             * тип пункта такого поля не знает), ни сервером. Замер на проде
             * 22.09 по Москве — 439 пунктов, 1,07 МБ ответа, из них 90 % это
             * поле; без него 112 КБ. Список грузится целиком, до первой буквы
             * в поиске, и платит за него телефон покупателя.
             */
        ], $points);
    }

    public function quote(array $source, array $destination, array $parcel): array
    {
        $fromCode = $this->resolveCityCode($source);
        $toCode = $this->resolveCityCode($destination);

        if ($fromCode === 0 || $toCode === 0) {
            throw new RuntimeException('CDEK quote requires city_code on source and destination points.');
        }

        $dims = $parcel['dimensions_cm'] ?? ['length' => 20, 'width' => 15, 'height' => 10];
        $weightKg = (float) ($parcel['weight_kg'] ?? 0.5);

        $payload = [
            'type' => 1,
            'from_location' => ['code' => $fromCode],
            'to_location' => ['code' => $toCode],
            'packages' => [[
                'weight' => (int) round($weightKg * 1000),
                'length' => (int) ($dims['length'] ?? 20),
                'width' => (int) ($dims['width'] ?? 15),
                'height' => (int) ($dims['height'] ?? 10),
            ]],
        ];

        if (! empty($destination['external_point_id'])) {
            $payload['to_location']['delivery_point'] = $destination['external_point_id'];
        }

        if (! empty($source['external_point_id'])) {
            $payload['from_location']['delivery_point'] = $source['external_point_id'];
        }

        $raw = $this->api->calculateTariffList($payload);
        $tariffs = $raw['tariff_codes'] ?? [];
        $best = $tariffs[0] ?? null;

        if ($best === null) {
            throw new RuntimeException('CDEK returned no tariff options.');
        }

        $price = (float) ($best['delivery_sum'] ?? $best['total_sum'] ?? 0);

        return [
            'price_cents' => DeliveryQuoteRounding::roundKopecks((int) round($price * 100)),
            'tariff_code' => isset($best['tariff_code']) ? (string) $best['tariff_code'] : null,
            'currency' => 'RUB',
            'raw' => $raw,
        ];
    }

    public function createShipment(Shipment $shipment): array
    {
        $source = $shipment->source_point ?? [];
        $destination = $shipment->destination_point;
        $dims = $shipment->dimensions_cm ?? ['length' => 20, 'width' => 15, 'height' => 10];
        $weightKg = (float) ($shipment->weight_kg ?? 0.5);

        $seller = $shipment->seller;
        $buyer = $shipment->buyer;

        $payload = [
            'type' => 1,
            'number' => 'MZ-'.$shipment->uuid,
            'tariff_code' => (int) ($shipment->raw_payload['tariff_code'] ?? 136),
            // Пункт либо адрес — СДЭК требует на каждом конце что-то одно и
            // отвечает `[shipment_point] is empty` + `[from_location] is
            // empty`, когда нет ни того, ни другого. Раньше адреса не
            // передавались вовсе: ключей `from_location`/`to_location` в
            // теле не было, и тариф «от двери» сломался бы о то же самое.
            ...$this->конец('shipment_point', 'from_location', $source),
            ...$this->конец('delivery_point', 'to_location', $destination),
            'recipient' => [
                'name' => $buyer->profile?->display_name ?? 'Получатель',
                'phones' => [['number' => $buyer->phone ?? '+70000000000']],
            ],
            'sender' => [
                'name' => $seller->profile?->display_name ?? 'Отправитель',
                'phones' => [['number' => $seller->phone ?? '+70000000000']],
            ],
            'packages' => [[
                'number' => '1',
                'weight' => (int) round($weightKg * 1000),
                'length' => (int) ($dims['length'] ?? 20),
                'width' => (int) ($dims['width'] ?? 15),
                'height' => (int) ($dims['height'] ?? 10),
                'items' => [[
                    'name' => $shipment->listing->title,
                    'ware_key' => (string) $shipment->listing_id,
                    'payment' => ['value' => 0],
                    'cost' => (int) round(($shipment->listing->price_cents ?? 0) / 100),
                    'weight' => (int) round($weightKg * 1000),
                    'amount' => 1,
                ]],
            ]],
        ];

        $raw = $this->api->createOrder($payload);
        $entity = $raw['entity'] ?? $raw;

        return [
            'external_id' => isset($entity['uuid']) ? (string) $entity['uuid'] : null,
            'tracking_number' => isset($entity['cdek_number']) ? (string) $entity['cdek_number'] : null,
            'external_status' => isset($entity['statuses'][0]['code']) ? (string) $entity['statuses'][0]['code'] : null,
            'raw' => $raw,
        ];
    }

    public function fetchStatus(Shipment $shipment): array
    {
        if ($shipment->external_id === null) {
            throw new RuntimeException('Shipment has no CDEK external_id.');
        }

        $raw = $this->api->getOrder($shipment->external_id);
        $entity = $raw['entity'] ?? $raw;
        $lastStatus = $entity['statuses'][0]['code'] ?? null;

        return [
            'external_status' => is_string($lastStatus) ? $lastStatus : null,
            'tracking_number' => isset($entity['cdek_number']) ? (string) $entity['cdek_number'] : $shipment->tracking_number,
            'raw' => $raw,
        ];
    }

    /**
     * Один конец маршрута: пункт, если выбран, иначе адрес.
     *
     * Возвращает готовый кусок тела — либо `[$point => код]`, либо
     * `[$location => {code, address}]`, либо пустой массив, если в снимке
     * нет ни того, ни другого. Пустой ключ слать незачем: СДЭК на него
     * отвечает тем же `is empty`, что и на отсутствие.
     *
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function конец(string $point, string $location, array $snapshot): array
    {
        if (DeliveryPointSnapshot::hasPickupPoint($snapshot)) {
            return [$point => (string) $snapshot['external_point_id']];
        }

        if (! DeliveryPointSnapshot::hasAddress($snapshot)) {
            return [];
        }

        $address = $snapshot['address'];
        if (is_array($address)) {
            $address = $address['address'] ?? $address['full_address'] ?? '';
        }

        return [$location => array_filter([
            'code' => (int) ($snapshot['city_code'] ?? 0) > 0 ? (int) $snapshot['city_code'] : null,
            'address' => (string) $address,
        ], static fn ($v): bool => $v !== null && $v !== '')];
    }

    /**
     * @param  array<string, mixed>  $point
     */
    private function resolveCityCode(array $point): int
    {
        return (int) (
            $point['city_code']
            ?? ($point['meta']['city_code'] ?? null)
            ?? ($point['address']['city_code'] ?? null)
            ?? 0
        );
    }

    public function mapProviderStatus(string $status): ?ShipmentStatus
    {
        return match (strtoupper($status)) {
            'CREATED', 'ACCEPTED' => ShipmentStatus::Created,
            'RECEIVED_AT_SHIPMENT_WAREHOUSE', 'READY_FOR_SHIPMENT_IN_SENDER_CITY' => ShipmentStatus::Accepted,
            'TAKEN_BY_TRANSPORTER', 'SENT_TO_TRANSIT_CITY', 'ACCEPTED_IN_TRANSIT_CITY',
            'SENT_TO_RECIPIENT_CITY', 'ACCEPTED_IN_RECIPIENT_CITY' => ShipmentStatus::InTransit,
            'ACCEPTED_AT_PICK_UP_POINT', 'POSTOMAT_POSTED' => ShipmentStatus::AtPickup,
            'DELIVERED', 'POSTOMAT_RECEIVED' => ShipmentStatus::Delivered,
            'NOT_DELIVERED', 'INVALID', 'CANCELLED' => ShipmentStatus::Cancelled,
            default => null,
        };
    }
}
