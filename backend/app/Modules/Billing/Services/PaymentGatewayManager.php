<?php

namespace Modules\Billing\Services;

use App\Models\User;
use Modules\Billing\Contracts\PaymentGateway;

/**
 * Resolves payment provider: VTB (primary) → stub (dev).
 *
 * YooKassa was removed in spec v4.0 — all acquiring goes through VTB and all
 * internal money movement goes through the wallet ledger.
 */
class PaymentGatewayManager implements PaymentGateway
{
    public function __construct(
        private readonly VtbPaymentGateway $vtb,
        private readonly StubPaymentGateway $stub,
    ) {}

    public function provider(): string
    {
        return $this->resolve()->provider();
    }

    public function isConfigured(): bool
    {
        return $this->resolve()->isConfigured();
    }

    public function createCheckout(User $user, int $amountCents, string $currency, string $description, array $metadata = []): array
    {
        return $this->resolve()->createCheckout($user, $amountCents, $currency, $description, $metadata);
    }

    public function handleWebhook(array $payload): void
    {
        $this->resolve()->handleWebhook($payload);
    }

    public function resolve(): PaymentGateway
    {
        $mode = config('billing.provider', 'auto');

        return match ($mode) {
            'stub' => $this->stub,
            'vtb' => $this->vtb->isConfigured() ? $this->vtb : $this->stub,
            default => $this->vtb->isConfigured() ? $this->vtb : $this->stub,
        };
    }

    public function gatewayForProvider(string $provider): PaymentGateway
    {
        return match ($provider) {
            'vtb' => $this->vtb,
            default => $this->stub,
        };
    }
}
