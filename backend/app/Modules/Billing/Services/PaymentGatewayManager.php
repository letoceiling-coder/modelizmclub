<?php

namespace Modules\Billing\Services;

use App\Models\User;
use Modules\Billing\Contracts\PaymentGateway;

/**
 * Resolves payment provider: VTB (primary) → YooKassa (fallback) → stub (dev).
 */
class PaymentGatewayManager implements PaymentGateway
{
    public function __construct(
        private readonly VtbPaymentGateway $vtb,
        private readonly YooKassaPaymentGateway $yookassa,
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
            'vtb' => $this->vtb->isConfigured() ? $this->vtb : $this->fallbackAfterVtb(),
            'yookassa' => $this->yookassa->isConfigured() ? $this->yookassa : $this->stub,
            default => $this->resolveAuto(),
        };
    }

    private function resolveAuto(): PaymentGateway
    {
        if ($this->vtb->isConfigured()) {
            return $this->vtb;
        }

        if ($this->yookassa->isConfigured()) {
            return $this->yookassa;
        }

        return $this->stub;
    }

    private function fallbackAfterVtb(): PaymentGateway
    {
        if ($this->yookassa->isConfigured()) {
            return $this->yookassa;
        }

        return $this->stub;
    }

    public function gatewayForProvider(string $provider): PaymentGateway
    {
        return match ($provider) {
            'vtb' => $this->vtb,
            'yookassa' => $this->yookassa,
            default => $this->stub,
        };
    }
}
