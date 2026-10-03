<?php

namespace Modules\Billing\Services;

use App\Models\User;
use Modules\Billing\Contracts\PaymentGateway;
use Modules\Billing\Exceptions\PaymentContourUnavailableException;

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
        $шлюз = $this->resolve();
        $this->откажиПодменеНаПроде($шлюз);

        return $шлюз->createCheckout($user, $amountCents, $currency, $description, $metadata);
    }

    /**
     * Можно ли сейчас принимать деньги подменным шлюзом.
     *
     * Подменный шлюз — это страница `/pay/stub/{uuid}` с выбором исхода
     * «оплачено / нет денег / отказ карты». Вне прода на нём и живут. На
     * проде он означает, что человек проходит ненастоящую оплату, а
     * подтверждение выдаёт настоящую подписку.
     *
     * Разрешён на проде только по явному `BILLING_PROVIDER=stub`: такое
     * решение видно в `.env` и принято кем-то осознанно. Всё остальное —
     * подмена ненастроенного шлюза, то есть молчаливое следствие сбоя, а не
     * решение.
     *
     * Сбой этот уже случался: 07.09 `config:clear` при нечитаемом `.env`
     * обнулил все `env()`. Тогда `BILLING_PROVIDER` становится `auto`,
     * `VTB_ACQUIRING_ENABLED` — `false`, резолв даёт подменный шлюз, а
     * подтверждение в режиме `auto` разрешено. Замерено 03.10: в этом
     * состоянии `POST /payments/{uuid}/confirm-stub` отвечает 200 и выдаёт
     * подписку. Шесть минут простоя в тот день были дешевле шести минут
     * бесплатных подписок.
     */
    public function stubAllowed(): bool
    {
        if (config('billing.provider') === 'stub') {
            return true;
        }

        return ! app()->environment('production');
    }

    /**
     * Отказ вместо подмены.
     *
     * Запрет стоит на создании платежа, а не в `resolve()`: `provider()`
     * обязан отвечать правду, на ней держится диагностика
     * (`deploy/scripts/check-live-money.sh` считает `stub` находкой, и если
     * резолв начнёт врать, проверка перестанет видеть проблему).
     */
    private function откажиПодменеНаПроде(PaymentGateway $шлюз): void
    {
        if ($шлюз->provider() === 'stub' && ! $this->stubAllowed()) {
            throw new PaymentContourUnavailableException();
        }
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
