<?php

namespace Modules\Billing\Services;

use App\Enums\EscrowDealStatus;
use App\Models\EscrowDeal;
use App\Models\Listing;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Clients\VtbAcquiringClient;
use RuntimeException;

/**
 * VTB two-phase (preAuth) checkout for marketplace escrow deals.
 */
class VtbEscrowService
{
    public function __construct(
        private readonly VtbAcquiringClient $client,
        private readonly PaymentRecorder $recorder,
    ) {}

    public function isEnabled(): bool
    {
        if (! config('billing.vtb.enabled')) {
            return false;
        }

        if (config('billing.vtb.token')) {
            return true;
        }

        return (bool) (config('billing.vtb.username') && config('billing.vtb.password'));
    }

    /**
     * @return array{escrow_uuid: string, checkout_url: string|null, status: string, provider: string}
     */
    public function startCheckout(
        User $buyer,
        Listing $listing,
        User $seller,
        int $itemAmountCents,
        int $deliveryAmountCents,
        int $platformFeeCents,
        int $sellerPayoutCents,
        array $feeSnapshot,
        ?int $shipmentId = null,
    ): array {
        return DB::transaction(function () use (
            $buyer,
            $listing,
            $seller,
            $itemAmountCents,
            $deliveryAmountCents,
            $platformFeeCents,
            $sellerPayoutCents,
            $feeSnapshot,
            $shipmentId,
        ): array {
            $dealUuid = (string) \Illuminate\Support\Str::uuid();
            $totalCents = $itemAmountCents + $deliveryAmountCents;

            $payment = $this->recorder->createPending(
                $buyer,
                $totalCents,
                $listing->currency ?? config('billing.currency', 'RUB'),
                'vtb',
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
                'amount_cents' => $totalCents,
                'item_amount_cents' => $itemAmountCents,
                'delivery_amount_cents' => $deliveryAmountCents,
                'seller_payout_cents' => $sellerPayoutCents,
                'platform_fee_cents' => $platformFeeCents,
                'currency' => $listing->currency ?? 'RUB',
                'status' => EscrowDealStatus::PendingPayment,
                'payment_provider' => 'vtb',
                'payment_id' => $payment->id,
                'fee_snapshot' => $feeSnapshot,
            ]);

            $returnUrl = $this->appendQuery(
                str_replace('{listing_uuid}', $listing->uuid, (string) config('billing.safe_deal.return_url')),
                [
                    'escrow_uuid' => $escrow->uuid,
                    'provider' => 'vtb',
                ],
            );

            $failUrl = $this->appendQuery(
                str_replace('{listing_uuid}', $listing->uuid, (string) config('billing.fail_url', config('billing.frontend_url').'/ads/'.$listing->uuid.'?escrow=failed')),
                [
                    'escrow_uuid' => $escrow->uuid,
                    'provider' => 'vtb',
                ],
            );

            $register = $this->client->registerPreAuthOrder([
                'orderNumber' => $payment->uuid,
                'amount' => $totalCents,
                'currency' => config('billing.vtb.currency_code'),
                'returnUrl' => $returnUrl,
                'failUrl' => $failUrl,
                'description' => mb_substr("Безопасная сделка: {$listing->title}", 0, 598),
                'language' => config('billing.vtb.language'),
                'clientId' => (string) $buyer->id,
                'dynamicCallbackUrl' => url('/api/v1/payments/webhooks/vtb'),
            ]);

            $orderId = (string) ($register['orderId'] ?? '');
            $formUrl = $register['formUrl'] ?? null;

            if ($orderId === '' || ! is_string($formUrl) || $formUrl === '') {
                throw new RuntimeException('Не удалось зарегистрировать preAuth в ВТБ.');
            }

            $payment->update([
                'provider_payment_id' => $orderId,
                'metadata' => array_merge($payment->metadata ?? [], ['checkout_url' => $formUrl]),
            ]);

            $escrow->update(['vtb_order_id' => $orderId]);

            return [
                'escrow_uuid' => $escrow->uuid,
                'checkout_url' => $formUrl,
                'status' => $escrow->status->value,
                'provider' => 'vtb',
            ];
        });
    }

    public function syncFromPayment(Payment $payment): void
    {
        $escrowUuid = $payment->metadata['escrow_deal_uuid'] ?? null;

        if (! is_string($escrowUuid) || $escrowUuid === '') {
            return;
        }

        $deal = EscrowDeal::query()->where('uuid', $escrowUuid)->first();

        if (! $deal || $deal->payment_provider !== 'vtb') {
            return;
        }

        $orderId = $deal->vtb_order_id ?? $payment->provider_payment_id;

        if (! $orderId) {
            return;
        }

        $status = $this->client->getOrderStatusExtended($orderId);
        $this->applyStatusResponse($deal, $payment, $status);
    }

    public function syncDeal(EscrowDeal $deal): EscrowDeal
    {
        $orderId = $deal->vtb_order_id;

        if (! $orderId) {
            throw new RuntimeException('У сделки нет идентификатора заказа ВТБ.');
        }

        $status = $this->client->getOrderStatusExtended($orderId);
        $payment = $deal->payment;

        if ($payment) {
            $this->applyStatusResponse($deal, $payment, $status);
        }

        return $deal->fresh(['listing', 'shipment']);
    }

    /** Buyer confirms receipt — capture hold and queue seller payout. */
    public function confirmReceipt(EscrowDeal $deal): EscrowDeal
    {
        if ($deal->captured_cents > 0) {
            throw new RuntimeException('Средства уже списаны.');
        }

        $orderId = $deal->vtb_order_id;

        if (! $orderId) {
            throw new RuntimeException('У сделки нет идентификатора заказа ВТБ.');
        }

        $amount = $deal->amount_cents;
        $response = $this->client->depositOrder($orderId, $amount);

        $deal->update([
            'captured_cents' => $amount,
            'status' => EscrowDealStatus::PayoutPending,
            'vtb_payment_state' => '2',
        ]);

        if ($deal->payment && $deal->payment->status !== 'paid') {
            $deal->payment->update(['status' => 'paid', 'paid_at' => now()]);
        }

        return $deal->fresh(['listing', 'shipment']);
    }

    public function cancelHold(EscrowDeal $deal): EscrowDeal
    {
        if ($deal->captured_cents > 0) {
            throw new RuntimeException('Холд уже списан — используйте возврат.');
        }

        $orderId = $deal->vtb_order_id;

        if ($orderId && $deal->paid_at !== null) {
            $this->client->reverseOrder($orderId);
        }

        $deal->update(['status' => EscrowDealStatus::Reversed]);

        return $deal->fresh(['listing', 'shipment']);
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function applyStatusResponse(EscrowDeal $deal, Payment $payment, array $status): void
    {
        $deal->update(['vtb_payment_state' => (string) ($status['orderStatus'] ?? '')]);

        if (VtbAcquiringClient::isAuthorizedHold($status) && $deal->status === EscrowDealStatus::PendingPayment) {
            $payment->update(['status' => 'paid', 'paid_at' => now()]);
            $deal->update([
                'status' => EscrowDealStatus::Funded,
                'paid_at' => now(),
            ]);

            return;
        }

        if (VtbAcquiringClient::isDeposited($status)) {
            if ($payment->status !== 'paid') {
                $payment->update(['status' => 'paid', 'paid_at' => now()]);
            }

            if ($deal->status !== EscrowDealStatus::Completed && $deal->status !== EscrowDealStatus::PayoutPending) {
                $deal->update([
                    'captured_cents' => $deal->amount_cents,
                    'status' => EscrowDealStatus::Captured,
                ]);
            }

            return;
        }

        if (VtbAcquiringClient::isReversed($status)) {
            $deal->update(['status' => EscrowDealStatus::Reversed]);

            return;
        }

        if (VtbAcquiringClient::isPaidStatus($status) && $deal->status === EscrowDealStatus::PendingPayment) {
            $payment->update(['status' => 'paid', 'paid_at' => now()]);
            $deal->update([
                'status' => EscrowDealStatus::Funded,
                'paid_at' => now(),
            ]);
        }
    }

    /** @param  array<string, string>  $params */
    private function appendQuery(string $url, array $params): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.http_build_query($params);
    }
}
