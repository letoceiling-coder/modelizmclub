<?php

namespace Modules\Billing\Services;

use App\Enums\DeliveryCarrier;
use App\Enums\EscrowDealStatus;
use App\Enums\ListingStatus;
use App\Enums\ShipmentStatus;
use App\Models\EscrowDeal;
use App\Models\Listing;
use App\Models\Payment;
use App\Models\Shipment;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserPayoutRequisites;
use App\Enums\EscrowOperationType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Clients\YooKassaClient;
use RuntimeException;

/**
 * Marketplace escrow orchestrator (YooKassa Safe Deal + VTB preAuth).
 */
class EscrowService
{
    /** Max kopecks storable in PostgreSQL integer columns (~21.47M ₽). */
    public const MAX_AMOUNT_CENTS = 2_147_483_647;

    public function __construct(
        private readonly YooKassaClient $yookassa,
        private readonly PaymentRecorder $recorder,
        private readonly EscrowFeeCalculator $feeCalculator,
        private readonly EscrowFeeSettings $feeSettings,
        private readonly VtbEscrowService $vtbEscrow,
    ) {}

    public function isFeatureEnabled(): bool
    {
        $row = SystemSetting::query()->where('key', 'feature.escrow_enabled')->value('value');

        return is_array($row) && ($row['enabled'] ?? false) === true;
    }

    public function isAvailable(): bool
    {
        return $this->isFeatureEnabled() && $this->resolveProvider() !== null;
    }

    public function resolveProvider(): ?string
    {
        $configured = config('billing.provider', 'auto');

        if ($configured === 'vtb' && $this->vtbEscrow->isEnabled()) {
            return 'vtb';
        }

        if ($configured === 'yookassa' && $this->isYookassaEnabled()) {
            return 'yookassa';
        }

        if ($configured === 'auto') {
            if ($this->vtbEscrow->isEnabled()) {
                return 'vtb';
            }
            if ($this->isYookassaEnabled()) {
                return 'yookassa';
            }
        }

        return null;
    }

    /** @return array<string, mixed> */
    public function quote(Listing $listing, int $deliveryAmountCents = 0): array
    {
        $itemCents = $listing->price_cents;
        $feeQuote = $this->feeCalculator->quote($itemCents, $deliveryAmountCents);
        $blockReason = $this->escrowAmountBlockReason($itemCents, $deliveryAmountCents);

        return [
            'listing_uuid' => $listing->uuid,
            'item_cents' => $itemCents,
            'delivery_cents' => $deliveryAmountCents,
            'platform_fee_cents' => $feeQuote['platform_fee_cents'],
            'seller_payout_cents' => $feeQuote['seller_payout_cents'],
            'total_cents' => $itemCents + $deliveryAmountCents,
            'fee_mode' => $feeQuote['fee_mode'] ?? 'unknown',
            'currency' => $listing->currency ?? 'RUB',
            'provider' => $this->resolveProvider(),
            'max_total_cents' => self::MAX_AMOUNT_CENTS,
            'can_checkout' => $blockReason === null && $this->isAvailable(),
            'checkout_block_reason' => $blockReason,
        ];
    }

    /**
     * @return array{escrow_uuid: string, checkout_url: string|null, status: string, provider: string}
     */
    public function startCheckout(User $buyer, Listing $listing, int $deliveryAmountCents = 0, ?int $shipmentId = null): array
    {
        $this->assertAvailable();
        $this->validateCheckout($buyer, $listing);

        $provider = $this->resolveProvider();
        $itemCents = $listing->price_cents;
        $feeQuote = $this->feeCalculator->quote($itemCents, $deliveryAmountCents);
        $platformFeeCents = $feeQuote['platform_fee_cents'];
        $sellerPayoutCents = $feeQuote['seller_payout_cents'];
        $feeSnapshot = $this->feeSettings->snapshot();

        if ($sellerPayoutCents <= 0) {
            throw ValidationException::withMessages([
                'listing' => ['Сумма слишком мала для безопасной сделки.'],
            ]);
        }

        $this->assertEscrowAmountLimit($itemCents, $deliveryAmountCents);

        $seller = $listing->author;

        if ($provider === 'vtb') {
            return $this->vtbEscrow->startCheckout(
                $buyer,
                $listing,
                $seller,
                $itemCents,
                $deliveryAmountCents,
                $platformFeeCents,
                $sellerPayoutCents,
                $feeSnapshot,
                $shipmentId,
            );
        }

        return $this->startYookassaCheckout(
            $buyer,
            $listing,
            $seller,
            $itemCents,
            $deliveryAmountCents,
            $platformFeeCents,
            $sellerPayoutCents,
            $feeSnapshot,
            $shipmentId,
        );
    }

    public function syncDeal(User $user, EscrowDeal $escrow): EscrowDeal
    {
        $this->assertParticipant($user, $escrow);

        if ($escrow->payment_provider === 'vtb') {
            return $this->vtbEscrow->syncDeal($escrow);
        }

        if ($escrow->status === EscrowDealStatus::PendingPayment && $escrow->yookassa_payment_id) {
            // YooKassa relies on webhook; nothing to poll here for buyers.
        }

        return $escrow->fresh(['listing', 'shipment']);
    }

    public function cancel(User $user, EscrowDeal $escrow, ?string $reason = null): EscrowDeal
    {
        $this->assertParticipant($user, $escrow);

        if ($escrow->status->isTerminal()) {
            throw ValidationException::withMessages(['escrow' => ['Сделка уже завершена.']]);
        }

        if (! in_array($escrow->status, [
            EscrowDealStatus::PendingPayment,
            EscrowDealStatus::Funded,
            EscrowDealStatus::Paid,
            EscrowDealStatus::AwaitingShipment,
        ], true)) {
            throw ValidationException::withMessages(['escrow' => ['Отмена недоступна в текущем статусе.']]);
        }

        if ($escrow->payment_provider === 'vtb') {
            $deal = $this->vtbEscrow->cancelHold($escrow);
        } else {
            $deal = $escrow;
            $deal->update(['status' => EscrowDealStatus::Cancelled]);
        }

        if ($reason) {
            $deal->update(['admin_note' => trim($reason)]);
        }

        return $deal->fresh(['listing', 'shipment']);
    }

    public function openDispute(User $user, EscrowDeal $escrow, string $reason): EscrowDeal
    {
        $this->assertAvailable();
        $this->assertParticipant($user, $escrow);

        if ($escrow->status->isTerminal()) {
            throw ValidationException::withMessages(['escrow' => ['Сделка уже завершена.']]);
        }

        if ($escrow->status === EscrowDealStatus::PendingPayment) {
            throw ValidationException::withMessages(['escrow' => ['Спор доступен после оплаты.']]);
        }

        if ($escrow->dispute_status === 'open') {
            throw ValidationException::withMessages(['escrow' => ['Спор уже открыт.']]);
        }

        if ($escrow->paid_at === null) {
            throw ValidationException::withMessages(['escrow' => ['Сделка ещё не оплачена.']]);
        }

        $windowDays = $this->feeSettings->disputeWindowDays();
        if ($escrow->paid_at->addDays($windowDays)->isPast()) {
            throw ValidationException::withMessages([
                'escrow' => ["Срок открытия спора истёк ({$windowDays} дн.)."],
            ]);
        }

        $recorder = app(EscrowOperationRecorder::class);
        $op = $recorder->start(
            $escrow,
            EscrowOperationType::DisputeOpen,
            $user->id === $escrow->buyer_id ? 'buyer' : 'seller',
            null,
            reason: $reason,
        );
        $recorder->succeed($op);

        $escrow->update([
            'status' => EscrowDealStatus::DisputeOpen,
            'dispute_status' => 'open',
            'admin_note' => trim($reason),
        ]);

        return $escrow->fresh(['listing', 'shipment']);
    }

    /** Seller marks order shipped (pickup or manual; carrier flow uses shipments/confirm). */
    public function markShipped(User $seller, EscrowDeal $escrow, ?string $trackingNumber = null): EscrowDeal
    {
        $this->assertAvailable();

        if ($escrow->seller_id !== $seller->id) {
            throw ValidationException::withMessages(['escrow' => ['Отметить отправку может только продавец.']]);
        }

        $allowed = [
            EscrowDealStatus::Funded,
            EscrowDealStatus::Paid,
            EscrowDealStatus::AwaitingShipment,
        ];

        if (! in_array($escrow->status, $allowed, true)) {
            throw ValidationException::withMessages(['escrow' => ['Отправка недоступна в текущем статусе.']]);
        }

        if ($escrow->isFrozen()) {
            throw ValidationException::withMessages(['escrow' => ['Сделка заморожена.']]);
        }

        $shipment = $escrow->shipment;

        if (! $shipment) {
            $shipment = Shipment::query()->create([
                'uuid' => (string) Str::uuid(),
                'listing_id' => $escrow->listing_id,
                'seller_id' => $escrow->seller_id,
                'buyer_id' => $escrow->buyer_id,
                'provider' => DeliveryCarrier::Cdek,
                'status' => ShipmentStatus::InTransit,
                'delivery_cost_cents' => $escrow->delivery_amount_cents,
                'currency' => $escrow->currency,
                'weight_kg' => 1.0,
                'destination_point' => ['label' => 'Самовывоз / ручная отправка'],
                'tracking_number' => $trackingNumber,
            ]);
            $escrow->update(['shipment_id' => $shipment->id]);
        } else {
            $shipment->update([
                'status' => ShipmentStatus::InTransit,
                'tracking_number' => $trackingNumber ?? $shipment->tracking_number,
            ]);
        }

        app(EscrowShipmentSync::class)->onShipmentUpdated($shipment->fresh());

        return $escrow->fresh(['listing', 'shipment']);
    }

    public function markPaid(EscrowDeal $escrow, ?string $providerPaymentId = null): void
    {
        if ($escrow->status !== EscrowDealStatus::PendingPayment) {
            return;
        }

        $escrow->update([
            'status' => EscrowDealStatus::AwaitingShipment,
            'paid_at' => now(),
            'yookassa_payment_id' => $providerPaymentId ?? $escrow->yookassa_payment_id,
        ]);
    }

    public function syncFromVtbPayment(Payment $payment): void
    {
        $this->vtbEscrow->syncFromPayment($payment);
    }

    /** Buyer confirms receipt — payout / capture. */
    public function confirmReceipt(User $buyer, EscrowDeal $escrow): EscrowDeal
    {
        $this->assertAvailable();

        if ($escrow->buyer_id !== $buyer->id) {
            throw ValidationException::withMessages([
                'escrow' => ['Подтвердить получение может только покупатель.'],
            ]);
        }

        if ($escrow->isFrozen()) {
            throw ValidationException::withMessages(['escrow' => ['Сделка заморожена.']]);
        }

        $allowed = [
            EscrowDealStatus::Paid,
            EscrowDealStatus::Funded,
            EscrowDealStatus::AwaitingShipment,
            EscrowDealStatus::AwaitingBuyerConfirm,
            EscrowDealStatus::Delivered,
            EscrowDealStatus::InTransit,
        ];

        if (! in_array($escrow->status, $allowed, true)) {
            throw ValidationException::withMessages([
                'escrow' => ['Сделка ещё не оплачена или уже завершена.'],
            ]);
        }

        if ($escrow->payment_provider === 'vtb') {
            $deal = $this->vtbEscrow->confirmReceipt($escrow);
            $this->finalizeCompleted($deal->fresh());

            return $deal->fresh(['listing', 'shipment']);
        }

        return $this->confirmYookassaReceipt($buyer, $escrow);
    }

    public function findByPaymentProviderId(string $providerPaymentId): ?EscrowDeal
    {
        return EscrowDeal::query()
            ->where('yookassa_payment_id', $providerPaymentId)
            ->orWhere('vtb_order_id', $providerPaymentId)
            ->first();
    }

    public function findActiveForListing(Listing $listing, User $user): ?EscrowDeal
    {
        return EscrowDeal::query()
            ->where('listing_id', $listing->id)
            ->where(function ($q) use ($user): void {
                $q->where('buyer_id', $user->id)->orWhere('seller_id', $user->id);
            })
            ->whereNotIn('status', [
                EscrowDealStatus::Completed,
                EscrowDealStatus::Cancelled,
                EscrowDealStatus::Reversed,
                EscrowDealStatus::Refunded,
                EscrowDealStatus::Failed,
            ])
            ->latest('id')
            ->first();
    }

    /** @return array<string, mixed> */
    public function toArray(EscrowDeal $escrow, ?User $viewer = null): array
    {
        $isBuyer = $viewer && $escrow->buyer_id === $viewer->id;
        $isSeller = $viewer && $escrow->seller_id === $viewer->id;
        $disputeOpen = ($escrow->dispute_status ?? 'none') === 'open';
        $withinDisputeWindow = $escrow->paid_at !== null
            && $escrow->paid_at->addDays($this->feeSettings->disputeWindowDays())->isFuture();

        return [
            'uuid' => $escrow->uuid,
            'listing_uuid' => $escrow->listing?->uuid,
            'listing_title' => $escrow->listing?->title,
            'listing_slug' => $escrow->listing?->slug,
            'status' => $escrow->status->value,
            'dispute_status' => $escrow->dispute_status ?? 'none',
            'payment_provider' => $escrow->payment_provider,
            'amount_cents' => $escrow->amount_cents,
            'item_amount_cents' => $escrow->item_amount_cents,
            'delivery_amount_cents' => $escrow->delivery_amount_cents,
            'seller_payout_cents' => $escrow->seller_payout_cents,
            'platform_fee_cents' => $escrow->platform_fee_cents,
            'captured_cents' => $escrow->captured_cents,
            'refunded_cents' => $escrow->refunded_cents,
            'paid_out_cents' => $escrow->paid_out_cents,
            'currency' => $escrow->currency,
            'paid_at' => $escrow->paid_at?->toIso8601String(),
            'completed_at' => $escrow->completed_at?->toIso8601String(),
            'frozen' => $escrow->isFrozen(),
            'role' => $isBuyer ? 'buyer' : ($isSeller ? 'seller' : null),
            'can_confirm_receipt' => $isBuyer && in_array($escrow->status, [
                EscrowDealStatus::Paid,
                EscrowDealStatus::Funded,
                EscrowDealStatus::AwaitingShipment,
                EscrowDealStatus::AwaitingBuyerConfirm,
                EscrowDealStatus::Delivered,
                EscrowDealStatus::InTransit,
            ], true) && ! $escrow->isFrozen() && ! $disputeOpen,
            'can_cancel' => ($isBuyer || $isSeller) && in_array($escrow->status, [
                EscrowDealStatus::PendingPayment,
                EscrowDealStatus::Funded,
                EscrowDealStatus::Paid,
                EscrowDealStatus::AwaitingShipment,
            ], true) && ! $disputeOpen,
            'can_open_dispute' => ($isBuyer || $isSeller)
                && ! $escrow->status->isTerminal()
                && $escrow->status !== EscrowDealStatus::PendingPayment
                && ! $disputeOpen
                && $withinDisputeWindow
                && ! $escrow->isFrozen(),
            'can_mark_shipped' => $isSeller && in_array($escrow->status, [
                EscrowDealStatus::Funded,
                EscrowDealStatus::Paid,
                EscrowDealStatus::AwaitingShipment,
            ], true) && ! $escrow->isFrozen() && ! $disputeOpen,
            'can_confirm_shipment' => $isSeller
                && $escrow->shipment !== null
                && in_array($escrow->shipment->status->value, ['quoted', 'awaiting_seller'], true)
                && ! $disputeOpen,
            'shipment' => $escrow->shipment ? [
                'uuid' => $escrow->shipment->uuid,
                'status' => $escrow->shipment->status->value,
                'tracking_number' => $escrow->shipment->tracking_number,
                'provider' => $escrow->shipment->provider->value ?? (string) $escrow->shipment->provider,
                'delivered_at' => $escrow->shipment->delivered_at?->toIso8601String(),
            ] : null,
        ];
    }

    private function isYookassaEnabled(): bool
    {
        return config('billing.yookassa.enabled')
            && config('billing.yookassa.shop_id')
            && config('billing.yookassa.secret_key')
            && config('billing.safe_deal.enabled');
    }

    private function assertAvailable(): void
    {
        if (! $this->isFeatureEnabled()) {
            throw ValidationException::withMessages([
                'escrow' => ['Безопасная сделка отключена администратором.'],
            ]);
        }

        if ($this->resolveProvider() === null) {
            throw ValidationException::withMessages([
                'escrow' => ['Безопасная сделка не подключена. Обратитесь к администратору.'],
            ]);
        }
    }

    private function validateCheckout(User $buyer, Listing $listing): void
    {
        if ($listing->status !== ListingStatus::Published) {
            throw ValidationException::withMessages([
                'listing' => ['Объявление недоступно для покупки.'],
            ]);
        }

        if ($listing->price_cents <= 0) {
            throw ValidationException::withMessages([
                'listing' => ['У объявления не указана цена.'],
            ]);
        }

        if ($listing->user_id === $buyer->id) {
            throw ValidationException::withMessages([
                'listing' => ['Нельзя купить собственное объявление.'],
            ]);
        }

        $existing = EscrowDeal::query()
            ->where('listing_id', $listing->id)
            ->whereNotIn('status', [
                EscrowDealStatus::Completed,
                EscrowDealStatus::Cancelled,
                EscrowDealStatus::Reversed,
                EscrowDealStatus::Refunded,
                EscrowDealStatus::Failed,
            ])
            ->exists();

        if ($existing) {
            throw ValidationException::withMessages([
                'listing' => ['По этому объявлению уже есть активная сделка.'],
            ]);
        }

        $seller = $listing->author;
        $provider = $this->resolveProvider();

        if ($provider === 'yookassa') {
            $card = UserPayoutRequisites::query()->where('user_id', $seller->id)->value('payout_card_number');

            if (! $card) {
                throw ValidationException::withMessages([
                    'seller' => ['Продавец не указал карту для выплат. Безопасная сделка недоступна.'],
                ]);
            }
        }
    }

    /**
     * @return array{escrow_uuid: string, checkout_url: string|null, status: string, provider: string}
     */
    private function startYookassaCheckout(
        User $buyer,
        Listing $listing,
        User $seller,
        int $itemCents,
        int $deliveryAmountCents,
        int $platformFeeCents,
        int $sellerPayoutCents,
        array $feeSnapshot,
        ?int $shipmentId,
    ): array {
        if (! $this->isYookassaEnabled()) {
            throw ValidationException::withMessages(['escrow' => ['ЮKassa Safe Deal не настроена.']]);
        }

        $amountCents = $itemCents + $deliveryAmountCents;

        return DB::transaction(function () use (
            $buyer,
            $listing,
            $seller,
            $amountCents,
            $itemCents,
            $deliveryAmountCents,
            $platformFeeCents,
            $sellerPayoutCents,
            $feeSnapshot,
            $shipmentId,
        ): array {
            $dealUuid = (string) Str::uuid();

            $remoteDeal = $this->yookassa->createDeal([
                'type' => 'safe_deal',
                'fee_moment' => config('billing.safe_deal.fee_moment', 'deal_closed'),
                'description' => "Сделка по объявлению #{$listing->id}",
                'metadata' => [
                    'listing_uuid' => $listing->uuid,
                    'buyer_id' => (string) $buyer->id,
                ],
            ], $dealUuid);

            $yookassaDealId = (string) ($remoteDeal['id'] ?? '');

            if ($yookassaDealId === '') {
                throw new RuntimeException('ЮKassa не вернула идентификатор сделки.');
            }

            $payment = $this->recorder->createPending(
                $buyer,
                $amountCents,
                $listing->currency ?? config('billing.currency', 'RUB'),
                'yookassa',
                [
                    'payable_type' => 'escrow',
                    'listing_id' => $listing->id,
                    'listing_uuid' => $listing->uuid,
                    'escrow_deal_uuid' => $dealUuid,
                ],
            );

            $escrow = EscrowDeal::create([
                'uuid' => $dealUuid,
                'listing_id' => $listing->id,
                'buyer_id' => $buyer->id,
                'seller_id' => $seller->id,
                'shipment_id' => $shipmentId,
                'amount_cents' => $amountCents,
                'item_amount_cents' => $itemCents,
                'delivery_amount_cents' => $deliveryAmountCents,
                'seller_payout_cents' => $sellerPayoutCents,
                'platform_fee_cents' => $platformFeeCents,
                'currency' => $listing->currency ?? 'RUB',
                'status' => EscrowDealStatus::PendingPayment,
                'payment_provider' => 'yookassa',
                'yookassa_deal_id' => $yookassaDealId,
                'payment_id' => $payment->id,
                'fee_snapshot' => $feeSnapshot,
            ]);

            $returnUrl = $this->appendQuery(
                str_replace('{listing_uuid}', $listing->uuid, (string) config('billing.safe_deal.return_url')),
                ['escrow_uuid' => $escrow->uuid, 'provider' => 'yookassa'],
            );

            $remotePayment = $this->yookassa->createPayment([
                'amount' => [
                    'value' => $this->formatMoney($amountCents),
                    'currency' => strtoupper($escrow->currency),
                ],
                'capture' => true,
                'confirmation' => [
                    'type' => 'redirect',
                    'return_url' => $returnUrl,
                ],
                'description' => mb_substr("Безопасная сделка: {$listing->title}", 0, 128),
                'metadata' => [
                    'payment_uuid' => $payment->uuid,
                    'escrow_uuid' => $escrow->uuid,
                    'listing_uuid' => $listing->uuid,
                ],
                'deal' => [
                    'id' => $yookassaDealId,
                    'settlements' => [[
                        'type' => 'payout',
                        'amount' => [
                            'value' => $this->formatMoney($sellerPayoutCents),
                            'currency' => strtoupper($escrow->currency),
                        ],
                    ]],
                ],
            ], $payment->uuid);

            $providerPaymentId = (string) ($remotePayment['id'] ?? '');
            $checkoutUrl = $remotePayment['confirmation']['confirmation_url'] ?? null;

            if ($providerPaymentId === '' || ! is_string($checkoutUrl) || $checkoutUrl === '') {
                throw new RuntimeException('Не удалось создать платёж в ЮKassa.');
            }

            $payment->update([
                'provider_payment_id' => $providerPaymentId,
                'metadata' => array_merge($payment->metadata ?? [], ['checkout_url' => $checkoutUrl]),
            ]);

            $escrow->update(['yookassa_payment_id' => $providerPaymentId]);

            return [
                'escrow_uuid' => $escrow->uuid,
                'checkout_url' => $checkoutUrl,
                'status' => $escrow->status->value,
                'provider' => 'yookassa',
            ];
        });
    }

    private function confirmYookassaReceipt(User $buyer, EscrowDeal $escrow): EscrowDeal
    {
        if (! $this->isYookassaEnabled()) {
            throw ValidationException::withMessages(['escrow' => ['ЮKassa Safe Deal не настроена.']]);
        }

        $card = UserPayoutRequisites::query()
            ->where('user_id', $escrow->seller_id)
            ->value('payout_card_number');

        if (! $card) {
            throw ValidationException::withMessages([
                'seller' => ['У продавца нет карты для выплаты.'],
            ]);
        }

        $payoutValue = $this->formatMoney($escrow->seller_payout_cents);
        $idempotenceKey = 'payout-'.$escrow->uuid;

        $remote = $this->yookassa->createPayout([
            'amount' => [
                'value' => $payoutValue,
                'currency' => strtoupper($escrow->currency),
            ],
            'payout_destination_data' => [
                'type' => 'bank_card',
                'card' => ['number' => $card],
            ],
            'deal' => ['id' => $escrow->yookassa_deal_id],
            'description' => mb_substr("Выплата по безопасной сделке {$escrow->uuid}", 0, 128),
            'metadata' => ['escrow_uuid' => $escrow->uuid],
        ], $idempotenceKey);

        $payoutId = (string) ($remote['id'] ?? '');

        if ($payoutId === '') {
            throw new RuntimeException('ЮKassa не создала выплату продавцу.');
        }

        $escrow->update([
            'status' => EscrowDealStatus::Completed,
            'yookassa_payout_id' => $payoutId,
            'completed_at' => now(),
            'paid_out_cents' => $escrow->seller_payout_cents,
        ]);

        $this->finalizeCompleted($escrow->fresh());

        return $escrow->fresh(['listing', 'shipment']);
    }

    private function finalizeCompleted(EscrowDeal $escrow): void
    {
        if ($escrow->status === EscrowDealStatus::PayoutPending) {
            $escrow->update([
                'status' => EscrowDealStatus::Completed,
                'completed_at' => now(),
                'paid_out_cents' => $escrow->seller_payout_cents,
            ]);
        }

        $listing = $escrow->listing;

        if ($listing && $listing->status === ListingStatus::Published) {
            $listing->update(['status' => ListingStatus::Sold]);
        }
    }

    private function assertParticipant(User $user, EscrowDeal $escrow): void
    {
        if ($escrow->buyer_id !== $user->id && $escrow->seller_id !== $user->id && ! $user->hasRole('admin')) {
            abort(403);
        }
    }

    private function formatMoney(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }

    /** @param  array<string, string>  $params */
    private function appendQuery(string $url, array $params): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.http_build_query($params);
    }

    private function escrowAmountBlockReason(int $itemCents, int $deliveryAmountCents): ?string
    {
        if ($itemCents > self::MAX_AMOUNT_CENTS || $deliveryAmountCents > self::MAX_AMOUNT_CENTS) {
            return $this->amountLimitMessage();
        }

        if ($itemCents + $deliveryAmountCents > self::MAX_AMOUNT_CENTS) {
            return $this->amountLimitMessage();
        }

        return null;
    }

    private function assertEscrowAmountLimit(int $itemCents, int $deliveryAmountCents): void
    {
        $reason = $this->escrowAmountBlockReason($itemCents, $deliveryAmountCents);

        if ($reason !== null) {
            throw ValidationException::withMessages(['listing' => [$reason]]);
        }
    }

    private function amountLimitMessage(): string
    {
        $maxRub = number_format(intdiv(self::MAX_AMOUNT_CENTS, 100), 0, '', ' ');

        return "Сумма сделки слишком велика для безопасной оплаты. Максимум — {$maxRub} ₽.";
    }
}
