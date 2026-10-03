<?php

namespace Modules\Billing\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Contracts\PaymentGateway;
use Modules\Billing\Exceptions\PaymentContourUnavailableException;

/**
 * Resolves payment provider: VTB (primary) → stub (dev).
 *
 * YooKassa was removed in spec v4.0 — all acquiring goes through VTB and all
 * internal money movement goes through the wallet ledger.
 *
 * ТЕСТОВЫЙ ЭКВАЙРИНГ НЕ ПОДМЕНЯЕТ БОЕВОЙ МОЛЧА. До 03.10 обе ветки с ВТБ
 * заканчивались `: $this->stub`, то есть ненастроенный шлюз подменялся
 * подменным — страницей с выбором исхода «оплачено / нет денег / отказ
 * карты». На проде это значит, что человек проходит ненастоящую оплату и
 * получает настоящую подписку или закрытую сделку.
 *
 * Дотянуться до этого можно было не ошибкой настройки, а сбоем, который на
 * проекте уже случался: 07.09 `config:clear` при нечитаемом `.env` обнулил
 * все `env()`. Тогда `BILLING_PROVIDER` стал бы `auto`, а
 * `VTB_ACQUIRING_ENABLED` — `false`: подменный шлюз, и `ConfirmStubPayment`
 * в режиме `auto` такие платежи подтверждать разрешает. Шесть минут простоя
 * в тот день были дешевле, чем шесть минут бесплатных подписок.
 *
 * Запрет стоит на создании платежа, а не в `resolve()`. Разница важная:
 * `resolve()` спрашивают и на чтение — `User` зовёт `provider()`, решая,
 * считать ли прошлые подменные платежи настоящими, и это происходит на
 * обычных запросах. Отказ оттуда уронил бы сайт целиком из-за настройки
 * оплаты. Отказ при создании роняет ровно оплату, то есть то, что и так
 * сломано.
 *
 * Раскладка:
 *
 *   `stub`  — подменный шлюз, всегда и везде. Решение явное, видно в `.env`.
 *   `vtb`   — только ВТБ. Не настроен — отказ, а не подмена.
 *   `auto`  — ВТБ, если настроен. Иначе: вне прода подменный, на проде отказ.
 *
 * То есть на проде подменный шлюз берёт деньги только у того, кто написал
 * его имя в настройках, и никогда — из-за сбоя чтения этих настроек.
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
        $this->откажиПодмене($шлюз);

        return $шлюз->createCheckout($user, $amountCents, $currency, $description, $metadata);
    }

    /**
     * Можно ли сейчас принимать деньги подменным шлюзом.
     *
     * Подменный шлюз — это страница `/pay/stub/{uuid}` с выбором исхода
     * «оплачено / нет денег / отказ карты». На проде он означает, что человек
     * проходит ненастоящую оплату, а подтверждение выдаёт настоящую подписку.
     *
     * Разрешён в двух случаях, и оба — осознанное решение, видное в `.env`:
     * явный `BILLING_PROVIDER=stub`, либо `auto` вне боевого окружения. Явный
     * `vtb` запрещает подмену и на стенде: раз провайдер назван, молча
     * подставлять другой нельзя — иначе разработчик правит боевой контур и
     * проверяет подменный.
     *
     * Запрещён, стало быть, там, где подмена была бы следствием сбоя, а не
     * решением. Сбой уже случался: 07.09 `config:clear` при нечитаемом `.env`
     * обнулил все `env()`, и `BILLING_PROVIDER` стал `auto`. Замерено 03.10:
     * в этом состоянии `POST /payments` отвечает 201 подменной ссылкой, а
     * `confirm-stub` — 200 и выдаёт подписку. Шесть минут простоя в тот день
     * были дешевле шести минут бесплатных подписок.
     */
    public function stubAllowed(): bool
    {
        $режим = (string) config('billing.provider', 'auto');

        if ($режим === 'stub') {
            return true;
        }

        return ! ($режим === 'vtb' || app()->environment('production'));
    }

    /**
     * Отказ вместо подмены — и запись, чего именно не хватило.
     *
     * Запрет стоит на создании платежа, а не в `resolve()`: `provider()`
     * обязан отвечать правду, на ней держится диагностика
     * (`deploy/scripts/check-live-money.sh` считает `stub` находкой, и если
     * резолв начнёт врать, проверка перестанет видеть проблему).
     *
     * В журнал уходит не сам отказ, а его причина по полям: какой режим, какое
     * окружение, что заполнено. Без этого на проде пришлось бы идти по ssh и
     * перебирать переменные руками — а отказ случается в худшую минуту, когда
     * человек стоит на экране оплаты.
     */
    private function откажиПодмене(PaymentGateway $шлюз): void
    {
        if ($шлюз->provider() !== 'stub' || $this->stubAllowed()) {
            return;
        }

        Log::error('Платёжный шлюз не настроен, подмена подменным запрещена', [
            'billing_provider' => (string) config('billing.provider', 'auto'),
            'окружение' => app()->environment(),
            'заполнено' => [
                'VTB_ACQUIRING_ENABLED' => (bool) config('billing.vtb.enabled'),
                'VTB_ACQUIRING_API_URL' => filled(config('billing.vtb.api_url')),
                'VTB_ACQUIRING_USERNAME' => filled(config('billing.vtb.username')),
                'VTB_ACQUIRING_PASSWORD' => filled(config('billing.vtb.password')),
                'VTB_ACQUIRING_TOKEN' => filled(config('billing.vtb.token')),
            ],
            'подсказка' => 'Подменный шлюз включается только BILLING_PROVIDER=stub либо вне прода при auto.',
        ]);

        throw new PaymentContourUnavailableException();
    }

    public function handleWebhook(array $payload): void
    {
        $this->resolve()->handleWebhook($payload);
    }

    /** Чтение: никогда не бросает, иначе падали бы обычные страницы. */
    public function resolve(): PaymentGateway
    {
        $mode = (string) config('billing.provider', 'auto');

        return match ($mode) {
            'stub' => $this->stub,
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
