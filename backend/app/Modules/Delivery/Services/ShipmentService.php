<?php

namespace Modules\Delivery\Services;

use App\Enums\DeliveryCarrier;
use App\Enums\ShipmentStatus;
use App\Models\Conversation;
use App\Models\DeliveryQuote;
use App\Models\Listing;
use App\Models\SellerDeliveryProfile;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class ShipmentService
{
    public function __construct(
        private readonly DeliveryCarrierRegistry $carriers,
        private readonly SellerDeliveryProfileService $sellerProfiles,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function createDraft(User $buyer, array $data): Shipment
    {
        $listing = Listing::query()->where('uuid', $data['listing_uuid'])->firstOrFail();
        $provider = DeliveryCarrier::from($data['provider']);

        $this->carriers->assertEnabled($provider);

        if (! in_array($this->providerLabel($provider), $listing->delivery_methods ?? [], true)) {
            throw ValidationException::withMessages([
                'provider' => ['Продавец не предлагает этот способ доставки для объявления.'],
            ]);
        }

        if ($listing->user_id === $buyer->id) {
            throw ValidationException::withMessages([
                'listing_uuid' => ['Нельзя оформить доставку на своё объявление.'],
            ]);
        }

        $conversationId = null;
        if (! empty($data['conversation_uuid'])) {
            $conversation = Conversation::query()->where('uuid', $data['conversation_uuid'])->firstOrFail();
            $conversationId = $conversation->id;
        }

        return Shipment::query()->create([
            'listing_id' => $listing->id,
            'conversation_id' => $conversationId,
            'seller_id' => $listing->user_id,
            'buyer_id' => $buyer->id,
            'provider' => $provider,
            'status' => ShipmentStatus::Draft,
            'destination_point' => $data['destination_point'],
            'weight_kg' => $data['weight_kg'] ?? null,
            'dimensions_cm' => $data['dimensions_cm'] ?? null,
        ]);
    }

    public function quote(Shipment $shipment): Shipment
    {
        $this->assertMutable($shipment);

        $source = $this->resolveSourcePoint($shipment);
        $adapter = $this->carriers->get($shipment->provider);

        $result = $adapter->quote($source, $shipment->destination_point, [
            'weight_kg' => $shipment->weight_kg,
            'dimensions_cm' => $shipment->dimensions_cm,
        ]);

        $quote = DeliveryQuote::query()->create([
            'shipment_id' => $shipment->id,
            'provider' => $shipment->provider,
            'source_point' => $source,
            'destination_point' => $shipment->destination_point,
            'parcels' => [
                'weight_kg' => $shipment->weight_kg,
                'dimensions_cm' => $shipment->dimensions_cm,
            ],
            'price_cents' => $result['price_cents'],
            'tariff_code' => $result['tariff_code'],
            'currency' => $result['currency'],
            'expires_at' => now()->addMinutes(30),
            'raw_payload' => $result['raw'],
        ]);

        $shipment->update([
            'source_point' => $source,
            'delivery_cost_cents' => $result['price_cents'],
            'currency' => $result['currency'],
            'status' => ShipmentStatus::Quoted,
            'quoted_at' => now(),
            'raw_payload' => array_merge($shipment->raw_payload ?? [], [
                'tariff_code' => $result['tariff_code'],
                'quote_uuid' => $quote->uuid,
            ]),
            'error_message' => null,
        ]);

        $this->recordEvent($shipment, ShipmentStatus::Quoted, null, 'Стоимость доставки рассчитана');

        return $shipment->fresh(['listing', 'seller', 'buyer', 'events']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateDraft(Shipment $shipment, User $actor, array $data): Shipment
    {
        $this->assertParticipant($shipment, $actor);
        $this->assertMutable($shipment);

        if ($actor->id === $shipment->seller_id && isset($data['seller_point_id'])) {
            $profile = SellerDeliveryProfile::query()->findOrFail($data['seller_point_id']);
            $this->sellerProfiles->assertOwnedBy($profile, $actor);

            if ($profile->provider !== $shipment->provider) {
                throw ValidationException::withMessages([
                    'seller_point_id' => ['Точка отправки должна соответствовать провайдеру отправления.'],
                ]);
            }

            $shipment->seller_point_id = $profile->id;
            $shipment->source_point = $profile->toPointSnapshot();
        }

        if ($actor->id === $shipment->buyer_id) {
            if (isset($data['destination_point'])) {
                $shipment->destination_point = $data['destination_point'];
            }
            if (isset($data['weight_kg'])) {
                $shipment->weight_kg = $data['weight_kg'];
            }
            if (isset($data['dimensions_cm'])) {
                $shipment->dimensions_cm = $data['dimensions_cm'];
            }
        }

        $shipment->save();

        return $shipment->fresh(['listing', 'seller', 'buyer', 'events']);
    }

    public function requestSellerConfirmation(Shipment $shipment, User $buyer): Shipment
    {
        $this->assertParticipant($shipment, $buyer);
        if ($buyer->id !== $shipment->buyer_id) {
            throw ValidationException::withMessages(['shipment' => ['Подтвердить может только покупатель после расчёта.']]);
        }

        if ($shipment->status !== ShipmentStatus::Quoted) {
            throw ValidationException::withMessages(['status' => ['Сначала рассчитайте стоимость доставки.']]);
        }

        $shipment->update(['status' => ShipmentStatus::AwaitingSeller]);
        $this->recordEvent($shipment, ShipmentStatus::AwaitingSeller, null, 'Ожидает подтверждения продавца');

        return $shipment->fresh(['listing', 'seller', 'buyer', 'events']);
    }

    public function confirmAndCreate(User $seller, Shipment $shipment): Shipment
    {
        if ($seller->id !== $shipment->seller_id) {
            throw ValidationException::withMessages(['shipment' => ['Подтвердить отправку может только продавец.']]);
        }

        if (! in_array($shipment->status, [ShipmentStatus::Quoted, ShipmentStatus::AwaitingSeller], true)) {
            throw ValidationException::withMessages(['status' => ['Отправление нельзя подтвердить в текущем статусе.']]);
        }

        if ($shipment->source_point === null) {
            $shipment->source_point = $this->resolveSourcePoint($shipment);
            $shipment->save();
        }

        $shipment->update(['status' => ShipmentStatus::Creating]);
        $adapter = $this->carriers->get($shipment->provider);

        try {
            $result = $adapter->createShipment($shipment->load('listing', 'seller.profile', 'buyer.profile'));

            $mapped = $result['external_status'] !== null
                ? $adapter->mapProviderStatus($result['external_status'])
                : null;

            $shipment->update([
                'status' => $mapped ?? ShipmentStatus::Created,
                'external_id' => $result['external_id'],
                'tracking_number' => $result['tracking_number'],
                'external_status' => $result['external_status'],
                'created_at_provider' => now(),
                'raw_payload' => $result['raw'],
                'error_message' => null,
            ]);

            $this->recordEvent(
                $shipment,
                $shipment->status,
                $result['external_status'],
                'Заказ создан у провайдера доставки',
                $result['raw'],
            );
        } catch (\Throwable $e) {
            $shipment->update([
                'status' => ShipmentStatus::Error,
                'error_message' => $e->getMessage(),
            ]);
            $this->recordEvent($shipment, ShipmentStatus::Error, null, $e->getMessage());

            throw $e;
        }

        return $shipment->fresh(['listing', 'seller', 'buyer', 'events']);
    }

    public function cancel(User $actor, Shipment $shipment): Shipment
    {
        $this->assertParticipant($shipment, $actor);

        if (in_array($shipment->status, [ShipmentStatus::Delivered, ShipmentStatus::Cancelled], true)) {
            throw ValidationException::withMessages(['status' => ['Отправление уже завершено.']]);
        }

        $shipment->update([
            'status' => ShipmentStatus::Cancelled,
            'cancelled_at' => now(),
        ]);
        $this->recordEvent($shipment, ShipmentStatus::Cancelled, null, 'Отправление отменено');

        return $shipment->fresh(['listing', 'seller', 'buyer', 'events']);
    }

    public function syncStatus(Shipment $shipment): Shipment
    {
        if ($shipment->external_id === null) {
            return $shipment;
        }

        $adapter = $this->carriers->get($shipment->provider);
        $result = $adapter->fetchStatus($shipment);

        $mapped = $result['external_status'] !== null
            ? $adapter->mapProviderStatus($result['external_status'])
            : null;

        $updates = [
            'external_status' => $result['external_status'],
            'raw_payload' => $result['raw'],
        ];

        if ($result['tracking_number'] !== null) {
            $updates['tracking_number'] = $result['tracking_number'];
        }

        if ($mapped !== null) {
            $updates['status'] = $mapped;
            if ($mapped === ShipmentStatus::Delivered) {
                $updates['delivered_at'] = now();
            }
        }

        $shipment->update($updates);

        if ($mapped !== null) {
            $this->recordEvent($shipment, $mapped, $result['external_status'], 'Статус обновлён', $result['raw']);
        }

        return $shipment->fresh(['listing', 'seller', 'buyer', 'events']);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginateForUser(User $user, array $filters): LengthAwarePaginator
    {
        $query = Shipment::query()
            ->with(['listing', 'seller.profile', 'buyer.profile'])
            ->where(function ($q) use ($user, $filters): void {
                if (($filters['role'] ?? null) === 'seller') {
                    $q->where('seller_id', $user->id);
                } elseif (($filters['role'] ?? null) === 'buyer') {
                    $q->where('buyer_id', $user->id);
                } else {
                    $q->where('seller_id', $user->id)->orWhere('buyer_id', $user->id);
                }
            })
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['provider'] ?? null, fn ($q, $provider) => $q->where('provider', $provider))
            ->latest();

        return $query->paginate(min((int) ($filters['per_page'] ?? 20), 50));
    }

    public function applyWebhookUpdate(Shipment $shipment, ?string $providerStatus, ?string $trackingNumber, array $payload): Shipment
    {
        $adapter = $this->carriers->get($shipment->provider);
        $mapped = $providerStatus !== null ? $adapter->mapProviderStatus($providerStatus) : null;

        $updates = ['raw_payload' => $payload];
        if ($providerStatus !== null) {
            $updates['external_status'] = $providerStatus;
        }
        if ($trackingNumber !== null) {
            $updates['tracking_number'] = $trackingNumber;
        }
        if ($mapped !== null) {
            $updates['status'] = $mapped;
            if ($mapped === ShipmentStatus::Delivered) {
                $updates['delivered_at'] = now();
            }
        }

        $shipment->update($updates);

        if ($mapped !== null) {
            $this->recordEvent($shipment, $mapped, $providerStatus, 'Webhook: обновление статуса', $payload);
        }

        return $shipment;
    }

    public function assertParticipant(Shipment $shipment, User $user): void
    {
        if (! $shipment->isParticipant($user)) {
            throw ValidationException::withMessages([
                'shipment' => ['Нет доступа к этому отправлению.'],
            ]);
        }
    }

    private function assertMutable(Shipment $shipment): void
    {
        if (! in_array($shipment->status, [ShipmentStatus::Draft, ShipmentStatus::Quoted, ShipmentStatus::AwaitingSeller], true)) {
            throw ValidationException::withMessages([
                'status' => ['Отправление нельзя изменить в текущем статусе.'],
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveSourcePoint(Shipment $shipment): array
    {
        if ($shipment->source_point !== null) {
            return $shipment->source_point;
        }

        if ($shipment->seller_point_id !== null) {
            $profile = SellerDeliveryProfile::query()->find($shipment->seller_point_id);
            if ($profile !== null) {
                return $profile->toPointSnapshot();
            }
        }

        $default = $this->sellerProfiles->defaultFor(
            User::query()->findOrFail($shipment->seller_id),
            $shipment->provider,
        );

        if ($default === null) {
            throw ValidationException::withMessages([
                'source_point' => ['Продавец не указал точку отправки. Добавьте склад/ПВЗ в профиле доставки.'],
            ]);
        }

        $shipment->update([
            'seller_point_id' => $default->id,
            'source_point' => $default->toPointSnapshot(),
        ]);

        return $default->toPointSnapshot();
    }

    private function recordEvent(
        Shipment $shipment,
        ShipmentStatus $status,
        ?string $providerStatus,
        ?string $message = null,
        ?array $payload = null,
    ): void {
        ShipmentEvent::query()->create([
            'shipment_id' => $shipment->id,
            'status' => $status->value,
            'provider_status' => $providerStatus,
            'message' => $message,
            'occurred_at' => now(),
            'payload' => $payload,
        ]);
    }

    private function providerLabel(DeliveryCarrier $provider): string
    {
        return match ($provider) {
            DeliveryCarrier::Cdek => 'СДЭК',
            DeliveryCarrier::Yandex => 'Яндекс Доставка',
        };
    }
}
