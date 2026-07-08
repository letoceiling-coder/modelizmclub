<?php

namespace Modules\Delivery\Services\Carriers;

use App\Enums\DeliveryCarrier;
use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use Modules\Delivery\Contracts\DeliveryCarrierContract;
use Modules\Delivery\Contracts\YandexGateway;
use RuntimeException;

class YandexDeliveryAdapter implements DeliveryCarrierContract
{
    public function __construct(
        private readonly YandexGateway $yandex,
    ) {}

    public function carrier(): DeliveryCarrier
    {
        return DeliveryCarrier::Yandex;
    }

    public function listPickupPoints(array $filters): array
    {
        $body = array_filter([
            'geo_id' => $filters['geo_id'] ?? null,
            'type' => $filters['type'] ?? 'pickup_point',
            'payment_method' => 'already_paid',
            'available_for_dropoff' => $filters['available_for_dropoff'] ?? null,
        ], fn ($v) => $v !== null);

        if (isset($filters['latitude'], $filters['longitude'])) {
            $body['latitude'] = [
                'from' => (float) $filters['latitude'] - 0.05,
                'to' => (float) $filters['latitude'] + 0.05,
            ];
            $body['longitude'] = [
                'from' => (float) $filters['longitude'] - 0.05,
                'to' => (float) $filters['longitude'] + 0.05,
            ];
        }

        $raw = $this->yandex->listPickupPoints($body);
        $points = $raw['points'] ?? [];

        return array_map(fn (array $point): array => [
            'id' => (string) ($point['id'] ?? ''),
            'name' => (string) ($point['name'] ?? ''),
            'address' => $point['address']['fullname'] ?? $point['address']['street'] ?? null,
            'city' => $point['address']['locality'] ?? null,
            'latitude' => $point['position']['latitude'] ?? null,
            'longitude' => $point['position']['longitude'] ?? null,
            'type' => $point['type'] ?? 'pickup_point',
            'available_for_dropoff' => $point['available_for_dropoff'] ?? false,
            'raw' => $point,
        ], $points);
    }

    public function quote(array $source, array $destination, array $parcel): array
    {
        $sourceId = $source['external_point_id'] ?? null;
        $destId = $destination['external_point_id'] ?? null;

        if ($sourceId === null || $destId === null) {
            throw new RuntimeException('Yandex quote requires platform_station_id on source and destination.');
        }

        $dims = $parcel['dimensions_cm'] ?? ['length' => 20, 'width' => 15, 'height' => 10];
        $weightKg = (float) ($parcel['weight_kg'] ?? 0.5);

        $payload = [
            'source' => ['platform_station_id' => $sourceId],
            'destination' => [
                'platform_station_id' => $destId,
                'address' => $destination['address']['fullname'] ?? $destination['label'] ?? '',
            ],
            'tariff' => 'self_pickup',
            'total_weight' => (int) round($weightKg * 1000),
            'payment_method' => 'already_paid',
            'places' => [[
                'physical_dims' => [
                    'weight_gross' => (int) round($weightKg * 1000),
                    'dx' => (int) ($dims['length'] ?? 20),
                    'dy' => (int) ($dims['width'] ?? 15),
                    'dz' => (int) ($dims['height'] ?? 10),
                ],
            ]],
        ];

        $raw = $this->yandex->calculatePrice($payload);
        $price = (float) ($raw['pricing_total'] ?? $raw['price'] ?? 0);

        return [
            'price_cents' => (int) round($price),
            'tariff_code' => 'self_pickup',
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

        $payload = [
            'info' => [
                'operator_request_id' => 'MZ-'.$shipment->uuid,
            ],
            'source' => [
                'platform_station_id' => $source['external_point_id'] ?? null,
            ],
            'destination' => [
                'platform_station_id' => $destination['external_point_id'] ?? null,
                'type' => 'platform_station',
            ],
            'items' => [[
                'count' => 1,
                'name' => $shipment->listing->title,
                'article' => (string) $shipment->listing_id,
                'billing_details' => [
                    'unit_price' => (int) ($shipment->listing->price_cents ?? 0),
                    'assessed_unit_price' => (int) ($shipment->listing->price_cents ?? 0),
                ],
                'physical_dims' => [
                    'dx' => (int) ($dims['length'] ?? 20),
                    'dy' => (int) ($dims['width'] ?? 15),
                    'dz' => (int) ($dims['height'] ?? 10),
                    'weight_gross' => (int) round($weightKg * 1000),
                ],
            ]],
            'billing_info' => [
                'payment_method' => 'already_paid',
            ],
            'recipient_info' => [
                'first_name' => $shipment->buyer->profile?->display_name ?? 'Получатель',
                'phone' => $shipment->buyer->phone ?? '+70000000000',
            ],
        ];

        $raw = $this->yandex->createOffer($payload);

        return [
            'external_id' => isset($raw['request_id']) ? (string) $raw['request_id'] : ($raw['offer_id'] ?? null),
            'tracking_number' => isset($raw['tracking_number']) ? (string) $raw['tracking_number'] : null,
            'external_status' => isset($raw['status']) ? (string) $raw['status'] : null,
            'raw' => $raw,
        ];
    }

    public function fetchStatus(Shipment $shipment): array
    {
        if ($shipment->external_id === null) {
            throw new RuntimeException('Shipment has no Yandex external_id.');
        }

        $raw = $this->yandex->getRequestInfo(['request_id' => $shipment->external_id]);

        return [
            'external_status' => isset($raw['status']) ? (string) $raw['status'] : null,
            'tracking_number' => isset($raw['tracking_number']) ? (string) $raw['tracking_number'] : $shipment->tracking_number,
            'raw' => $raw,
        ];
    }

    public function mapProviderStatus(string $status): ?ShipmentStatus
    {
        return match (strtolower($status)) {
            'created', 'validated' => ShipmentStatus::Created,
            'accepted', 'sorting_center_at' => ShipmentStatus::Accepted,
            'delivery_at', 'delivery_transit' => ShipmentStatus::InTransit,
            'ready_for_pickup', 'pickup_point_at' => ShipmentStatus::AtPickup,
            'delivered', 'delivered_to_receiver' => ShipmentStatus::Delivered,
            'cancelled', 'returned' => ShipmentStatus::Cancelled,
            'failed', 'error' => ShipmentStatus::Error,
            default => null,
        };
    }
}
