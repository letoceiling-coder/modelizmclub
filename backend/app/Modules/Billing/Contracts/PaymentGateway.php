<?php

namespace Modules\Billing\Contracts;

use App\Models\User;

interface PaymentGateway
{
    public function provider(): string;

    public function isConfigured(): bool;

    /**
     * @param  array<string, mixed>  $metadata
     * @return array{payment_uuid: string, checkout_url: ?string, status: string, provider: string}
     */
    public function createCheckout(User $user, int $amountCents, string $currency, string $description, array $metadata = []): array;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handleWebhook(array $payload): void;
}
