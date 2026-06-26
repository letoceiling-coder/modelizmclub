<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Str;
use Modules\Billing\Contracts\PaymentGateway;

/**
 * Local stub when VTB / YooKassa credentials are not configured.
 */
class StubPaymentGateway implements PaymentGateway
{
    public function __construct(
        private readonly PaymentRecorder $recorder,
    ) {}

    public function provider(): string
    {
        return 'stub';
    }

    public function isConfigured(): bool
    {
        return true;
    }

    public function createCheckout(User $user, int $amountCents, string $currency, string $description, array $metadata = []): array
    {
        $payment = $this->recorder->createPending(
            $user,
            $amountCents,
            $currency,
            $this->provider(),
            array_merge($metadata, ['description' => $description]),
            $metadata['idempotency_key'] ?? null,
        );

        if (! $payment->wasRecentlyCreated && $payment->provider === 'stub') {
            return [
                'payment_uuid' => $payment->uuid,
                'checkout_url' => null,
                'status' => $payment->status,
                'provider' => $this->provider(),
            ];
        }

        $payment->update([
            'provider_payment_id' => 'stub-'.Str::uuid(),
        ]);

        return [
            'payment_uuid' => $payment->uuid,
            'checkout_url' => null,
            'status' => $payment->status,
            'provider' => $this->provider(),
        ];
    }

    public function handleWebhook(array $payload): void
    {
        $uuid = (string) ($payload['payment_uuid'] ?? '');

        if ($uuid === '') {
            return;
        }

        $payment = Payment::query()->where('uuid', $uuid)->first();

        if ($payment) {
            app(PaymentFulfillmentService::class)->markPaid($payment);
        }
    }
}
