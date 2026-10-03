<?php

namespace Modules\Billing\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Contracts\PaymentGateway;
use RuntimeException;

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

        if ($шлюз === $this->stub && $this->substitutionForbidden()) {
            throw $this->refuse();
        }

        return $шлюз->createCheckout($user, $amountCents, $currency, $description, $metadata);
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

    /**
     * Можно ли сейчас брать деньги подменным шлюзом.
     *
     * `stub` в настройках — можно: это написали руками. Всё остальное на
     * проде и любой `vtb` — нельзя.
     */
    public function substitutionForbidden(): bool
    {
        $mode = (string) config('billing.provider', 'auto');

        if ($mode === 'stub') {
            return false;
        }

        return $mode === 'vtb' || app()->environment('production');
    }

    public function gatewayForProvider(string $provider): PaymentGateway
    {
        return match ($provider) {
            'vtb' => $this->vtb,
            default => $this->stub,
        };
    }

    /**
     * Отказ вместо подмены.
     *
     * В журнал — какой переменной не хватает: иначе разбор «оплата не
     * работает» начинается с чтения кода, а не с чтения лога.
     */
    private function refuse(): RuntimeException
    {
        Log::error('Платёжный шлюз не настроен, подмена тестовым запрещена', [
            'billing_provider' => (string) config('billing.provider', 'auto'),
            'окружение' => app()->environment(),
            'заполнено' => [
                'VTB_ACQUIRING_ENABLED' => (bool) config('billing.vtb.enabled'),
                'VTB_ACQUIRING_USERNAME' => filled(config('billing.vtb.username')),
                'VTB_ACQUIRING_PASSWORD' => filled(config('billing.vtb.password')),
                'VTB_ACQUIRING_TOKEN' => filled(config('billing.vtb.token')),
            ],
            'api_url' => (string) config('billing.vtb.api_url'),
            'подсказка' => 'Подменный шлюз на проде включается только BILLING_PROVIDER=stub.',
        ]);

        return new RuntimeException(
            'Платёжный шлюз не настроен. Подмена тестовым эквайрингом запрещена.',
        );
    }
}
