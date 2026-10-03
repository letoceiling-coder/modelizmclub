<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
use App\Support\PaymentFailure;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Clients\VtbAcquiringClient;
use Modules\Billing\Contracts\PaymentGateway;
use RuntimeException;

class VtbPaymentGateway implements PaymentGateway
{
    public function __construct(
        private readonly VtbAcquiringClient $client,
        private readonly PaymentRecorder $recorder,
        private readonly PaymentFulfillmentService $fulfillment,
    ) {}

    public function provider(): string
    {
        return 'vtb';
    }

    public function isConfigured(): bool
    {
        if (! config('billing.vtb.enabled')) {
            return false;
        }

        if (config('billing.vtb.token')) {
            return true;
        }

        return config('billing.vtb.username') && config('billing.vtb.password');
    }

    public function createCheckout(User $user, int $amountCents, string $currency, string $description, array $metadata = []): array
    {
        $payment = $this->recorder->createPending(
            $user,
            $amountCents,
            $currency,
            $this->provider(),
            $metadata,
            $metadata['idempotency_key'] ?? null,
        );

        if ($payment->provider_payment_id && $payment->status === 'pending') {
            return $this->toCheckoutResponse($payment, $payment->metadata['checkout_url'] ?? null);
        }

        $returnUrl = $this->appendQuery((string) ($metadata['return_url'] ?? config('billing.return_url')), [
            'uuid' => $payment->uuid,
            'provider' => $this->provider(),
        ]);

        $failUrl = $this->appendQuery((string) ($metadata['fail_url'] ?? config('billing.fail_url')), [
            'uuid' => $payment->uuid,
            'provider' => $this->provider(),
        ]);

        $register = $this->client->registerOrder([
            'orderNumber' => $payment->uuid,
            'amount' => $amountCents,
            'currency' => config('billing.vtb.currency_code'),
            'returnUrl' => $returnUrl,
            'failUrl' => $failUrl,
            'description' => mb_substr($description, 0, 598),
            'language' => config('billing.vtb.language'),
            'clientId' => (string) $user->id,
            'dynamicCallbackUrl' => url('/api/v1/payments/webhooks/vtb'),
        ]);

        $orderId = (string) ($register['orderId'] ?? '');
        $formUrl = $register['formUrl'] ?? null;

        if ($orderId === '' || ! $formUrl) {
            /*
             * Заказа у банка нет и формы человек не увидит — значит шаг
             * `created`, а не `unknown`. Писался `unknown`, потому что
             * вызов шёл двумя доводами, и в воронке этот случай
             * сливался с отказами, причину которых узнать не удалось.
             */
            $this->fulfillment->markFailed(
                $payment,
                'VTB register.do missing orderId/formUrl',
                PaymentFailure::CODE_REGISTER_FAILED,
                is_string($register['errorMessage'] ?? null) ? $register['errorMessage'] : null,
                PaymentFailure::STAGE_CREATED,
                PaymentFailure::BY_GATEWAY,
            );
            throw new RuntimeException('Не удалось зарегистрировать заказ в ВТБ.');
        }

        $meta = array_merge($payment->metadata ?? [], ['checkout_url' => $formUrl]);
        $payment->update([
            'provider_payment_id' => $orderId,
            'metadata' => $meta,
        ]);

        return $this->toCheckoutResponse($payment->fresh(), $formUrl);
    }

    public function handleWebhook(array $payload): void
    {
        $orderId = (string) ($payload['mdOrder'] ?? $payload['orderId'] ?? '');

        if ($orderId === '') {
            // Ключи, не тело: в колбэке RBS лежит платёжный контур.
            Log::warning('VTB webhook without order id', ['ключи' => array_keys($payload)]);

            return;
        }

        $this->syncByProviderOrderId($orderId);
    }

    public function syncByProviderOrderId(string $orderId): void
    {
        $payment = Payment::query()
            ->where('provider', $this->provider())
            ->where('provider_payment_id', $orderId)
            ->first();

        if (! $payment) {
            Log::warning('VTB payment not found', ['orderId' => $orderId]);

            return;
        }

        $status = $this->client->getOrderStatusExtended($orderId);

        if (VtbAcquiringClient::isPaidStatus($status)) {
            $this->fulfillment->markPaid($payment, $orderId);

            return;
        }

        $orderStatus = $status['orderStatus'] ?? null;
        if (is_array($orderStatus)) {
            $orderStatus = $orderStatus['orderStatus'] ?? null;
        }

        if (in_array((int) $orderStatus, [3, 4, 6], true)) {
            /*
             * Колбэк — самый достоверный источник: банк сообщает сразу, а
             * не через четверть часа, как сверка. До 30.09 он писал сюда
             * только «VTB orderStatus=6» — без кода, без шага, без текста
             * банка, — и вся диагностика работала лишь в сверке. То есть
             * для живых платежей причина отказа опять была бы неизвестна.
             *
             * `actionCode` лежит в том же ответе, который мы уже прочли.
             */
            ['code' => $код, 'message' => $текст] = VtbAcquiringClient::actionCode($status);
            $наш = PaymentFailure::fromVtbActionCode($код);

            // «Срок заказа истёк» значит, что человек ушёл с формы: банк
            // отказа не выносил и карту никто не вводил.
            if ($наш === 'expired') {
                $this->fulfillment->markAbandoned(
                    $payment,
                    'Банк: срок заказа истёк, оплата не начиналась.',
                    PaymentFailure::STAGE_FORM,
                    PaymentFailure::BY_CALLBACK,
                );

                return;
            }

            $this->fulfillment->markFailed(
                $payment,
                'VTB orderStatus='.$orderStatus,
                $наш,
                $текст,
                PaymentFailure::STAGE_BANK,
                PaymentFailure::BY_CALLBACK,
            );
        }
    }

    /**
     * @return array{payment_uuid: string, checkout_url: ?string, status: string, provider: string}
     */
    private function toCheckoutResponse(Payment $payment, ?string $checkoutUrl): array
    {
        return [
            'payment_uuid' => $payment->uuid,
            'checkout_url' => $checkoutUrl,
            'status' => $payment->status,
            'provider' => $this->provider(),
        ];
    }

    /**
     * @param  array<string, string>  $params
     */
    private function appendQuery(string $url, array $params): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.http_build_query($params);
    }
}
