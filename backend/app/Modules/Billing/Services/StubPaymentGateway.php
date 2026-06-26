<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Str;
use Modules\Billing\Contracts\PaymentGateway;

/**
 * Stub gateway until YooKassa / VTB credentials are configured.
 */
class StubPaymentGateway implements PaymentGateway
{
    public function createCheckout(User $user, int $amountCents, string $currency, string $description, array $metadata = []): array
    {
        $payment = Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => $amountCents,
            'currency' => $currency,
            'status' => 'pending',
            'provider' => 'stub',
            'metadata' => array_merge($metadata, ['description' => $description]),
        ]);

        return [
            'payment_uuid' => $payment->uuid,
            'checkout_url' => null,
            'status' => $payment->status,
            'provider' => 'stub',
        ];
    }

    public function handleWebhook(string $provider, array $payload): void
    {
        // Provider-specific webhook handling will be implemented when gateway is chosen.
    }
}
