<?php

namespace Modules\Account\Services;

use App\Models\SavedPaymentMethod;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Modules\Billing\Clients\YooKassaClient;
use Modules\Billing\Exceptions\PaymentContourUnavailableException;
use Modules\Billing\Contracts\PaymentGateway;
use Modules\Billing\Services\PaymentGatewayManager;

class CardBindingService
{
    public function __construct(
        private readonly PaymentGatewayManager $gateways,
        private readonly YooKassaClient $yookassa,
    ) {}

    /**
     * Привязка карты — у ЮKassa, а не у того, кто принимает платежи.
     *
     * ЧТО БЫЛО. Провайдер выбирался по платёжному шлюзу
     * (`$this->gateways->resolve()->provider()`), а тот отвечает `stub` или
     * `vtb` — ветки `'yookassa'` он не возвращает никогда. Значит на проде
     * срабатывал `default => startStub`, и «привязка карты» сохраняла
     * поддельную visa ****4242. Замерено на проде 03.10: такие строки есть у
     * двух живых людей, вторая от 2 сентября — то есть уже после перехода на
     * боевой шлюз. Человек видит в кабинете карту, которой нет.
     *
     * Заодно `startYooKassa` оказывался недостижимым кодом, хотя ключи ЮKassa
     * на проде боевые (`live_`), а в `config/billing.php` она прямо названа
     * подсистемой привязки карт.
     *
     * КАК ТЕПЕРЬ. Провайдер выбирается по тому, настроена ли ЮKassa, —
     * то есть по делу, а не по соседней подсистеме. Подменная привязка
     * остаётся там, где она и нужна: вне прода и при явном
     * `BILLING_PROVIDER=stub`. На проде без ЮKassa — отказ, а не поддельная
     * карта: `stubAllowed()` то же самое правило, что у приёма денег, и
     * второго определения быть не должно.
     *
     * @return array{binding_url: string}
     */
    public function start(User $user): array
    {
        if ($this->yookassaНастроена()) {
            return $this->startYooKassa($user);
        }

        if ($this->gateways->stubAllowed()) {
            return $this->startStub($user);
        }

        throw new PaymentContourUnavailableException(
            'Привязка карты временно недоступна: платёжный шлюз не настроен.',
        );
    }

    private function yookassaНастроена(): bool
    {
        return (bool) config('billing.yookassa.enabled')
            && filled(config('billing.yookassa.shop_id'))
            && filled(config('billing.yookassa.secret_key'));
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
