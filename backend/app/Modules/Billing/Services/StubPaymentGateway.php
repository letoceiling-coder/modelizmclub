<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
use App\Models\User;
use Modules\Billing\Contracts\PaymentGateway;
use Modules\Billing\Exceptions\PaymentContourUnavailableException;

/**
 * Test acquiring: creates a pending payment and sends the user to an in-app
 * VTB-like page with simulated outcomes (paid / no funds / declined card).
 * Live charges never go through this gateway — use VtbPaymentGateway.
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
        $this->откажиНаПроде();

        $payment = $this->recorder->createPending(
            $user,
            $amountCents,
            $currency,
            $this->provider(),
            array_merge($metadata, [
                'description' => $description,
                'test_acquiring' => true,
            ]),
            $metadata['idempotency_key'] ?? null,
        );

        $checkoutUrl = $this->hostedCheckoutUrl($payment);
        $urls = $this->returnUrls($payment, $metadata);
        $meta = array_merge($payment->metadata ?? [], [
            'checkout_url' => $checkoutUrl,
            'return_url' => $urls['return_url'],
            'fail_url' => $urls['fail_url'],
        ]);
        $payment->update([
            'provider_payment_id' => $payment->provider_payment_id ?: 'stub-'.$payment->uuid,
            'metadata' => $meta,
        ]);

        return [
            'payment_uuid' => $payment->uuid,
            'checkout_url' => $checkoutUrl,
            'status' => $payment->status,
            'provider' => $this->provider(),
        ];
    }

    public function handleWebhook(array $payload): void
    {
        $this->откажиНаПроде();

        $uuid = (string) ($payload['payment_uuid'] ?? '');

        if ($uuid === '') {
            return;
        }

        /*
         * Только свои платежи.
         *
         * Отбор был по одному `uuid`, без провайдера: подменный обработчик мог
         * довести до оплаты платёж ВТБ. Подписи он не проверяет и банк не
         * спрашивает — в отличие от `VtbPaymentGateway`, — поэтому единственное,
         * что его сдерживает, это свой провайдер.
         *
         * Сегодня до него не дотянуться: маршрут вебхука ведёт в
         * `VtbWebhookController`, а тот внедряет `VtbPaymentGateway` по классу, а
         * не по интерфейсу. Но три из четырёх точек создания платежа внедряют
         * именно интерфейс, и одна правка внедрения отделяла это от живой дыры.
         */
        $payment = Payment::query()
            ->where('uuid', $uuid)
            ->where('provider', $this->provider())
            ->first();

        if ($payment) {
            app(PaymentFulfillmentService::class)->markPaid($payment);
        }
    }

    /**
     * Подменный шлюз на боевом окружении не работает.
     *
     * Запрет стоит здесь, а не только в `PaymentGatewayManager`: там он
     * обходится — `resolve()` и `gatewayForProvider()` публичные, первый уже
     * зовут снаружи (`CardBindingService`), а второй отдаёт подменный шлюз для
     * всего, что не `vtb`. Горловина, через которую проходят все пути, — вот
     * эти два метода.
     *
     * Условие одно и то же: подменный шлюз разрешён только по явному
     * `BILLING_PROVIDER=stub` либо вне прода. Решение в `.env` видно, а подмена
     * ненастроенного шлюза — молчаливое следствие сбоя.
     */
    private function откажиНаПроде(): void
    {
        if (! app(PaymentGatewayManager::class)->stubAllowed()) {
            throw new PaymentContourUnavailableException();
        }
    }

    private function hostedCheckoutUrl(Payment $payment): string
    {
        return rtrim((string) config('billing.frontend_url'), '/').'/pay/stub/'.$payment->uuid;
    }

    /** @param  array<string, mixed>  $metadata */
    private function returnUrls(Payment $payment, array $metadata): array
    {
        $frontend = rtrim((string) config('billing.frontend_url'), '/');
        $type = (string) ($metadata['payable_type'] ?? $payment->metadata['payable_type'] ?? 'subscription');

        $return = match ($type) {
            'wallet_topup' => $frontend.'/settings/wallet?payment=success',
            'listing_placement', 'listing_boost' => $frontend.'/my-ads?payment=success',
            default => (string) config('billing.return_url'),
        };
        $fail = match ($type) {
            'wallet_topup' => $frontend.'/settings/wallet?payment=failed',
            'listing_placement', 'listing_boost' => $frontend.'/my-ads?payment=failed',
            default => (string) config('billing.fail_url'),
        };

        return [
            'return_url' => (string) ($metadata['return_url'] ?? $return),
            'fail_url' => (string) ($metadata['fail_url'] ?? $fail),
        ];
    }
}
