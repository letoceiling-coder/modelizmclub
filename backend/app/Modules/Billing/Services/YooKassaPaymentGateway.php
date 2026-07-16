<?php

namespace Modules\Billing\Services;

use App\Enums\EscrowDealStatus;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Modules\Account\Services\CardBindingService;
use Modules\Billing\Clients\YooKassaClient;
use Modules\Billing\Contracts\PaymentGateway;
use RuntimeException;

class YooKassaPaymentGateway implements PaymentGateway
{
    public function __construct(
        private readonly YooKassaClient $client,
        private readonly PaymentRecorder $recorder,
        private readonly PaymentFulfillmentService $fulfillment,
    ) {}

    public function provider(): string
    {
        return 'yookassa';
    }

    public function isConfigured(): bool
    {
        return config('billing.yookassa.enabled')
            && config('billing.yookassa.shop_id')
            && config('billing.yookassa.secret_key');
    }

    public function createCheckout(User $user, int $amountCents, string $currency, string $description, array $metadata = []): array
    {
        $payment = $this->recorder->createPending(
            $user,
            $amountCents,
            $currency,
            $this->provider(),
            $metadata,
            $metadata['idempotency_key'] ?? null,
        );

        if ($payment->provider_payment_id && $payment->status === 'pending') {
            $checkoutUrl = $payment->metadata['checkout_url'] ?? null;

            return $this->toCheckoutResponse($payment, is_string($checkoutUrl) ? $checkoutUrl : null);
        }

        $returnUrl = $this->appendQuery(config('billing.return_url'), [
            'uuid' => $payment->uuid,
            'provider' => $this->provider(),
        ]);

        $amountValue = number_format($amountCents / 100, 2, '.', '');
        $currencyUpper = strtoupper($currency);

        $requestPayload = [
            'amount' => [
                'value' => $amountValue,
                'currency' => $currencyUpper,
            ],
            'capture' => true,
            'confirmation' => [
                'type' => 'redirect',
                'return_url' => $returnUrl,
            ],
            'description' => mb_substr($description, 0, 128),
            'metadata' => [
                'payment_uuid' => $payment->uuid,
                'user_id' => (string) $user->id,
                'plan_slug' => (string) ($metadata['plan_slug'] ?? ''),
            ],
        ];

        $receipt = $this->buildReceipt($user, $description, $amountValue, $currencyUpper);
        if ($receipt !== null) {
            $requestPayload['receipt'] = $receipt;
        }

        $remote = $this->client->createPayment($requestPayload, $payment->uuid);

        $providerId = (string) ($remote['id'] ?? '');
        $checkoutUrl = $remote['confirmation']['confirmation_url'] ?? null;

        if ($providerId === '' || ! is_string($checkoutUrl) || $checkoutUrl === '') {
            $this->fulfillment->markFailed($payment, 'YooKassa create payment incomplete response');
            throw new RuntimeException('Не удалось создать платёж в ЮKassa.');
        }

        $payment->update([
            'provider_payment_id' => $providerId,
            'metadata' => array_merge($payment->metadata ?? [], ['checkout_url' => $checkoutUrl]),
        ]);

        return $this->toCheckoutResponse($payment->fresh(), $checkoutUrl);
    }

    /**
     * Build a 54-ФЗ fiscal receipt. Required when the shop has онлайн-касса
     * enabled (otherwise YooKassa returns "Receipt is missing or illegal").
     * Returns null when receipts are disabled or no customer contact exists.
     *
     * @return array<string, mixed>|null
     */
    private function buildReceipt(User $user, string $description, string $amountValue, string $currency): ?array
    {
        if (! config('billing.yookassa.receipt_enabled', true)) {
            return null;
        }

        $email = is_string($user->email) && $user->email !== '' ? $user->email : null;
        $phoneDigits = is_string($user->phone ?? null) ? preg_replace('/\D/', '', (string) $user->phone) : null;

        $customer = array_filter([
            'email' => $email,
            'phone' => $phoneDigits !== null && $phoneDigits !== '' ? $phoneDigits : null,
        ]);

        // YooKassa requires at least one contact to send the fiscal receipt.
        if ($customer === []) {
            return null;
        }

        $receipt = [
            'customer' => $customer,
            'items' => [[
                'description' => mb_substr($description, 0, 128),
                'quantity' => '1.00',
                'amount' => [
                    'value' => $amountValue,
                    'currency' => $currency,
                ],
                'vat_code' => (int) config('billing.yookassa.vat_code', 1),
                'payment_mode' => (string) config('billing.yookassa.payment_mode', 'full_payment'),
                'payment_subject' => (string) config('billing.yookassa.payment_subject', 'service'),
            ]],
        ];

        $taxSystem = config('billing.yookassa.tax_system_code');
        if ($taxSystem !== null && $taxSystem !== '') {
            $receipt['tax_system_code'] = (int) $taxSystem;
        }

        return $receipt;
    }

    public function handleWebhook(array $payload): void
    {
        $event = (string) ($payload['event'] ?? '');
        $object = $payload['object'] ?? null;

        if (! is_array($object)) {
            return;
        }

        $providerId = (string) ($object['id'] ?? '');

        if ($providerId === '') {
            return;
        }

        if ($event === 'payment.succeeded') {
            $payment = $this->findByProviderId($providerId);

            if ($payment) {
                $this->syncSucceeded($providerId);

                if (($payment->fresh()->metadata['payable_type'] ?? null) === 'escrow') {
                    $escrow = app(EscrowService::class)->findByPaymentProviderId($providerId);
                    if ($escrow && $escrow->status === EscrowDealStatus::PendingPayment) {
                        app(EscrowService::class)->markPaid($escrow, $providerId);
                    }
                }
            } else {
                app(CardBindingService::class)->saveFromYooKassaWebhook($object);
            }

            return;
        }

        if (in_array($event, ['payment.canceled', 'payment.waiting_for_capture'], true)) {
            $payment = $this->findByProviderId($providerId);
            if ($payment && $event === 'payment.canceled') {
                $this->fulfillment->markFailed($payment, $event);
            }
        }
    }

    public function syncSucceeded(string $providerPaymentId): void
    {
        $remote = $this->client->getPayment($providerPaymentId);

        if (($remote['status'] ?? '') !== 'succeeded') {
            return;
        }

        $payment = $this->findByProviderId($providerPaymentId);

        if (! $payment) {
            Log::warning('YooKassa payment not found', ['id' => $providerPaymentId]);

            return;
        }

        $this->fulfillment->markPaid($payment, $providerPaymentId);
    }

    private function findByProviderId(string $providerId): ?Payment
    {
        return Payment::query()
            ->where('provider', $this->provider())
            ->where('provider_payment_id', $providerId)
            ->first();
    }

    /**
     * @return array{payment_uuid: string, checkout_url: ?string, status: string, provider: string}
     */
    private function toCheckoutResponse(Payment $payment, ?string $checkoutUrl): array
    {
        return [
            'payment_uuid' => $payment->uuid,
            'checkout_url' => $checkoutUrl,
            'status' => $payment->status,
            'provider' => $this->provider(),
        ];
    }

    /**
     * @param  array<string, string>  $params
     */
    private function appendQuery(string $url, array $params): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.http_build_query($params);
    }
}
