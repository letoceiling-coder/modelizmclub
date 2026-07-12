<?php

namespace Modules\Account\Services;

use App\Models\SavedPaymentMethod;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Modules\Billing\Clients\YooKassaClient;
use Modules\Billing\Contracts\PaymentGateway;
use Modules\Billing\Services\PaymentGatewayManager;

class CardBindingService
{
    public function __construct(
        private readonly PaymentGatewayManager $gateways,
        private readonly YooKassaClient $yookassa,
    ) {}

    /** @return array{binding_url: string} */
    public function start(User $user): array
    {
        $provider = $this->gateways->resolve()->provider();

        return match ($provider) {
            'stub' => $this->startStub($user),
            'yookassa' => $this->startYooKassa($user),
            default => $this->startStub($user),
        };
    }

    /** @return array{binding_url: string} */
    private function startStub(User $user): array
    {
        $token = (string) Str::uuid();
        Cache::put($this->cacheKey($token), $user->id, now()->addMinutes(30));

        $url = rtrim((string) config('app.url'), '/')
            .'/api/v1/account/payment-methods/bind/complete?token='.$token;

        return ['binding_url' => $url];
    }

    /** @return array{binding_url: string} */
    private function startYooKassa(User $user): array
    {
        $returnUrl = rtrim((string) config('billing.frontend_url'), '/')
            .'/settings/payment-methods?card=added';

        $remote = $this->yookassa->createPayment([
            'amount' => [
                'value' => '1.00',
                'currency' => 'RUB',
            ],
            'capture' => true,
            'save_payment_method' => true,
            'confirmation' => [
                'type' => 'redirect',
                'return_url' => $returnUrl,
            ],
            'description' => 'Привязка карты',
            'metadata' => [
                'binding' => 'card',
                'user_id' => (string) $user->id,
            ],
        ], (string) Str::uuid());

        $checkoutUrl = $remote['confirmation']['confirmation_url'] ?? null;
        $paymentMethod = $remote['payment_method'] ?? null;

        if (is_string($checkoutUrl) && $checkoutUrl !== '') {
            Cache::put(
                'yookassa_binding:'.$user->id,
                [
                    'payment_id' => (string) ($remote['id'] ?? ''),
                    'payment_method' => is_array($paymentMethod) ? $paymentMethod : null,
                ],
                now()->addHour(),
            );

            return ['binding_url' => $checkoutUrl];
        }

        return $this->startStub($user);
    }

    public function completeStub(string $token): ?User
    {
        $userId = Cache::pull($this->cacheKey($token));

        if (! $userId) {
            return null;
        }

        $user = User::query()->find($userId);

        if (! $user) {
            return null;
        }

        $this->saveMethod($user, 'stub', 'stub-'.Str::uuid(), 'visa', '4242');

        return $user;
    }

    public function saveFromYooKassaWebhook(array $object): void
    {
        $metadata = $object['metadata'] ?? [];
        if (($metadata['binding'] ?? null) !== 'card') {
            return;
        }

        $userId = (int) ($metadata['user_id'] ?? 0);
        $user = User::query()->find($userId);

        if (! $user) {
            return;
        }

        $pm = $object['payment_method'] ?? null;
        if (! is_array($pm) || empty($pm['id'])) {
            return;
        }

        $card = $pm['card'] ?? [];
        $this->saveMethod(
            $user,
            'yookassa',
            (string) $pm['id'],
            (string) ($card['card_type'] ?? $pm['type'] ?? 'card'),
            (string) ($card['last4'] ?? '0000'),
        );
    }

    private function saveMethod(User $user, string $provider, string $token, string $brand, string $last4): SavedPaymentMethod
    {
        SavedPaymentMethod::query()
            ->where('user_id', $user->id)
            ->update(['is_default' => false]);

        return SavedPaymentMethod::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'provider' => $provider,
            'provider_token' => $token,
            'brand' => strtolower($brand),
            'last4' => substr(preg_replace('/\D/', '', $last4) ?: '0000', -4),
            'is_default' => true,
        ]);
    }

    private function cacheKey(string $token): string
    {
        return 'card_binding:'.$token;
    }
}
