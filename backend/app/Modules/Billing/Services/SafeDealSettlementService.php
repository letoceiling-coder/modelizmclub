<?php

namespace Modules\Billing\Services;

use App\Enums\SafeDealGatewayContour;
use App\Enums\SafeDealIncomingStatus;
use App\Models\SafeDeal;
use App\Models\SafeDealGatewayEvent;
use App\Models\SafeDealIncomingPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Billing\Clients\VtbAcquiringClient;
use RuntimeException;
use Throwable;
use Modules\Billing\Support\SafeDealEscrowConfig;

/**
 * Money side of a safe deal, taken from the buyer's card by VTB.
 *
 * Two acquiring shapes map onto the same deal lifecycle. With a two-stage hold
 * the money stays on the buyer's card: `registerPreAuth` at checkout, `deposit`
 * on completion, `reverse` on cancellation. Where the bank has not granted
 * предавторизация, a one-stage `register.do` charges the card straight to the
 * merchant account and cancellation gives it back with `refund`. Every RBS
 * reply is journalled in `safe_deal_gateway_events`.
 */
class SafeDealSettlementService
{
    public const PROVIDER_VTB = 'vtb';

    public const PROVIDER_WALLET = 'wallet';

    public function __construct(private readonly VtbAcquiringClient $client) {}

    /** Which escrow backend this installation uses. */
    public function provider(): string
    {
        // Настройка из админки, иначе окружение — см. SafeDealEscrowConfig.
        $mode = SafeDealEscrowConfig::mode();

        return match ($mode) {
            self::PROVIDER_WALLET => self::PROVIDER_WALLET,
            self::PROVIDER_VTB => $this->vtbConfigured() ? self::PROVIDER_VTB : self::PROVIDER_WALLET,
            default => $this->vtbConfigured() ? self::PROVIDER_VTB : self::PROVIDER_WALLET,
        };
    }

    public function usesVtb(): bool
    {
        return $this->provider() === self::PROVIDER_VTB;
    }

    /** `two_stage` keeps the money on the card; `one_stage` charges it at once. */
    public function captureMode(): string
    {
        return (string) config('billing.safe_deal.vtb_capture_mode', SafeDealIncomingPayment::CAPTURE_TWO_STAGE)
            === SafeDealIncomingPayment::CAPTURE_ONE_STAGE
                ? SafeDealIncomingPayment::CAPTURE_ONE_STAGE
                : SafeDealIncomingPayment::CAPTURE_TWO_STAGE;
    }

    public function holdsOnCard(): bool
    {
        return $this->captureMode() === SafeDealIncomingPayment::CAPTURE_TWO_STAGE;
    }

    /**
     * Registers the charge and returns the row carrying the checkout URL. The
     * deal stays unpaid until VTB reports the card went through — orderStatus 1
     * (authorized) for a hold, 2 (deposited) for a one-stage charge.
     */
    public function openHold(SafeDeal $deal, User $buyer, string $description, ?string $returnUrl = null): SafeDealIncomingPayment
    {
        $twoStage = $this->holdsOnCard();

        $incoming = SafeDealIncomingPayment::query()->create([
            'uuid' => (string) Str::uuid(),
            'safe_deal_id' => $deal->id,
            'buyer_id' => $buyer->id,
            'amount_kopecks' => (int) $deal->amount_kopecks,
            'currency' => $deal->currency ?? 'RUB',
            'status' => SafeDealIncomingStatus::Pending,
            'capture_mode' => $this->captureMode(),
        ]);

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $target = $returnUrl ?: $base.'/deals/'.$deal->uuid;

        $params = [
            'orderNumber' => $incoming->uuid,
            'amount' => (int) $deal->amount_kopecks,
            'currency' => config('billing.vtb.currency_code'),
            'returnUrl' => $this->appendQuery($target, ['deal' => $deal->uuid, 'paid' => '1']),
            'failUrl' => $this->appendQuery($target, ['deal' => $deal->uuid, 'paid' => '0']),
            'description' => mb_substr($description, 0, 598),
            'language' => config('billing.vtb.language'),
            'clientId' => (string) $buyer->id,
            'dynamicCallbackUrl' => url('/api/v1/safe-deals/webhooks/vtb'),
        ];

        $endpoint = $twoStage ? 'registerPreAuth.do' : 'register.do';
        $register = $twoStage ? $this->client->registerPreAuth($params) : $this->client->registerOrder($params);

        $orderId = (string) ($register['orderId'] ?? '');
        $formUrl = $register['formUrl'] ?? null;

        /*
         * Дальше идут записи, и делить их нельзя.
         *
         * Строка холда создаётся до обращения в банк намеренно: банк
         * регистрирует заказ под нашим `orderNumber`, и если строки нет, то
         * и номера нет — заказ окажется ничьим. Но между ответом банка и
         * записью `rbs_order_id` до 11.09 не было ничего, что удержало бы
         * их вместе. Процесс, умерший в этом окне, оставлял заказ в банке
         * (возможно, с деньгами, замороженными на карте покупателя) и строку
         * без номера заказа. Такую строку не берёт ни опрос холдов — у него
         * `whereNotNull('rbs_order_id')`, — ни захват, ни возврат: оба
         * начинаются с той же проверки. То есть деньги зависали навсегда.
         *
         * Транзакция закрывает половину дела: запись номера и запись в
         * журнал теперь либо есть обе, либо нет ни одной. Вторая половина —
         * `recoverOrderId()` ниже: она находит заказ по `orderNumber`,
         * которым мы владеем всегда.
         *
         * Обращение к банку осталось выше, вне транзакции. Сеть не должна
         * держать блокировку строки — то же решение, что в развязке спора.
         */
        if ($orderId === '' || ! $formUrl) {
            DB::transaction(function () use ($incoming, $endpoint, $deal, $register): void {
                $locked = $this->lockIncoming($incoming);
                $locked->update([
                    'status' => SafeDealIncomingStatus::Failed,
                    'fail_reason' => $endpoint.' did not return orderId/formUrl',
                    'failed_at' => now(),
                ]);

                $this->journal($deal, $locked, 'payment.register_failed', $register);
            });

            // Бросаем после фиксации: исключение внутри транзакции откатило
            // бы и отметку об отказе — платёж остался бы «в ожидании».
            throw new RuntimeException('Не удалось зарегистрировать оплату в ВТБ.');
        }

        DB::transaction(function () use ($incoming, $orderId, $formUrl, $deal, $register, $twoStage): void {
            $locked = $this->lockIncoming($incoming);

            $locked->update([
                'rbs_order_id' => $orderId,
                'rbs_order_number' => $locked->uuid,
                'checkout_url' => $formUrl,
            ]);

            $this->journal($deal, $locked, $twoStage ? 'preauth.registered' : 'payment.registered', $register);
        });

        return $incoming->fresh();
    }

    /** Pulls the live RBS status and stores it. Returns the refreshed row. */
    public function syncHold(SafeDealIncomingPayment $incoming): SafeDealIncomingPayment
    {
        if (! $incoming->rbs_order_id) {
            return $incoming;
        }

        // Сеть — до транзакции. Внутри остаются только записи.
        $status = $this->client->getOrderStatusExtended($incoming->rbs_order_id);

        return $this->applyStatus($incoming, $status, 'order.status');
    }

    /**
     * Settles the money — call when the deal completes. A one-stage charge is
     * already on the merchant account, so there is nothing left to capture.
     */
    public function capture(SafeDealIncomingPayment $incoming): SafeDealIncomingPayment
    {
        if ($incoming->status === SafeDealIncomingStatus::Captured || ! $incoming->isTwoStage()) {
            return $incoming;
        }

        if (! $incoming->rbs_order_id) {
            throw new RuntimeException('Оплата в ВТБ не зарегистрирована.');
        }

        $response = $this->client->deposit($incoming->rbs_order_id, (int) $incoming->amount_kopecks);
        $this->journal($incoming->safeDeal, $incoming, 'preauth.captured', $response);

        return $this->syncHold($incoming);
    }

    /**
     * Gives the money back: `reverse` while the hold is uncaptured, `refund`
     * once it has already settled.
     */
    public function releaseBack(SafeDealIncomingPayment $incoming): SafeDealIncomingPayment
    {
        if (! $incoming->rbs_order_id) {
            return $incoming;
        }

        if (in_array($incoming->status, [SafeDealIncomingStatus::Reversed, SafeDealIncomingStatus::Refunded], true)) {
            return $incoming;
        }

        if ($incoming->status === SafeDealIncomingStatus::Captured) {
            $response = $this->client->refund($incoming->rbs_order_id, (int) $incoming->amount_kopecks);
            $this->journal($incoming->safeDeal, $incoming, 'payment.refunded', $response);
        } else {
            $response = $this->client->reverse($incoming->rbs_order_id);
            $this->journal($incoming->safeDeal, $incoming, 'preauth.reversed', $response);
        }

        return $this->syncHold($incoming);
    }

    /**
     * Найти в банке заказ, номер которого до нас не доехал.
     *
     * Случай узкий, но безвыходный: процесс умер между ответом банка и
     * записью `rbs_order_id`. Строка холда есть, заказ в банке есть, связи
     * между ними нет, и ни одна регулярная задача такую строку не подберёт.
     * Спросить банк можно по `orderNumber` — это uuid самой строки, и он у
     * нас был с самого начала.
     *
     * Возвращает строку как есть, если восстанавливать нечего или банк
     * такого заказа не знает: заказ мог и не зарегистрироваться, если
     * процесс умер раньше ответа.
     */
    public function recoverOrderId(SafeDealIncomingPayment $incoming): SafeDealIncomingPayment
    {
        if ($incoming->rbs_order_id || $incoming->status !== SafeDealIncomingStatus::Pending) {
            return $incoming;
        }

        $status = $this->client->getOrderStatusByNumber((string) $incoming->uuid);
        $orderId = (string) ($status['attributes']['orderId'] ?? $status['orderId'] ?? '');

        if ($orderId === '') {
            return $incoming;
        }

        return DB::transaction(function () use ($incoming, $orderId, $status): SafeDealIncomingPayment {
            $locked = $this->lockIncoming($incoming);

            $locked->rbs_order_id = $orderId;
            $locked->rbs_order_number = (string) $locked->uuid;
            $locked->applyRbsOrderStatus(VtbAcquiringClient::orderStatus($status));
            $locked->save();

            $this->journal($locked->safeDeal, $locked, 'order.recovered', $status);

            return $locked->fresh();
        });
    }

    /** Холды, у которых заказ в банке мог остаться без номера у нас. */
    public function pendingWithoutOrderId(int $olderThanMinutes, int $limit): \Illuminate\Support\Collection
    {
        return SafeDealIncomingPayment::query()
            ->whereNull('rbs_order_id')
            ->where('status', SafeDealIncomingStatus::Pending)
            ->where('created_at', '<=', now()->subMinutes(max(0, $olderThanMinutes)))
            ->orderBy('id')
            ->limit(max(1, $limit))
            ->get();
    }

    public function findByRbsOrderId(string $orderId): ?SafeDealIncomingPayment
    {
        return SafeDealIncomingPayment::query()
            ->with('safeDeal')
            ->where('rbs_order_id', $orderId)
            ->first();
    }

    /** Публичный, потому что по нему решает автоопрос холдов: спрашивать некого, если доступов нет. */
    public function vtbConfigured(): bool
    {
        if (! config('billing.vtb.enabled')) {
            return false;
        }

        return (bool) config('billing.vtb.token')
            || (config('billing.vtb.username') && config('billing.vtb.password'));
    }

    /**
     * Строка холда под блокировкой — то, с чем можно работать дальше.
     *
     * Вызывать только внутри транзакции: вне её блокировка снимается тем же
     * запросом, что её взял, и смысла не имеет. Объект, пришедший
     * аргументом, к этому моменту уже может врать — соседний опрос холда
     * или колбэк банка успели записать своё.
     */
    private function lockIncoming(SafeDealIncomingPayment $incoming): SafeDealIncomingPayment
    {
        return SafeDealIncomingPayment::query()
            ->whereKey($incoming->getKey())
            ->lockForUpdate()
            ->firstOrFail();
    }

    /**
     * Применить ответ банка к строке холда: статус и журнал одной записью.
     *
     * @param array<string, mixed> $status
     */
    private function applyStatus(SafeDealIncomingPayment $incoming, array $status, string $eventType): SafeDealIncomingPayment
    {
        return DB::transaction(function () use ($incoming, $status, $eventType): SafeDealIncomingPayment {
            $locked = $this->lockIncoming($incoming);

            $locked->applyRbsOrderStatus(VtbAcquiringClient::orderStatus($status));
            $locked->save();

            $this->journal($locked->safeDeal, $locked, $eventType, $status);

            return $locked->fresh();
        });
    }

    /**
     * Запись события шлюза в журнал.
     *
     * Ключ идемпотентности собран из типа события и содержимого ответа,
     * поэтому повторный тот же ответ банка даёт тот же ключ. Раньше это была
     * вставка с перехватом исключения — и на повторе она честно падала в
     * `unique`, а перехват гасил ошибку. В PostgreSQL этого мало: неудавшийся
     * оператор ломает всю транзакцию, и следующий запрос получает «current
     * transaction is aborted». Пока журнал вели только колбэки, повторов
     * почти не случалось; автоопрос спрашивает банк по расписанию и получает
     * один и тот же ответ, пока холд держится, — то есть повтор стал нормой.
     *
     * Затем стоял `firstOrCreate`, и его хватало, пока журнал писался вне
     * транзакции. Теперь записи после ответа банка идут внутри неё, и
     * `firstOrCreate` снова опасен: между его SELECT и INSERT успевает
     * вставить соседний опрос, INSERT падает в `unique` — и роняет всю
     * транзакцию, включая запись статуса. Перехват здесь не спасает: в
     * PostgreSQL транзакцию ломает сам факт неудавшегося оператора, а не
     * непойманное исключение.
     *
     * `insertOrIgnore` — единственная форма, которая не может испортить
     * транзакцию: конфликт разрешается в самом операторе (ON CONFLICT DO
     * NOTHING), неудачи нет. Ценой того, что модельные события и приведение
     * типов приходится делать руками — отсюда json_encode и явные метки
     * времени.
     *
     * @param array<string, mixed> $payload
     */
    private function journal(?SafeDeal $deal, SafeDealIncomingPayment $incoming, string $eventType, array $payload): void
    {
        try {
            SafeDealGatewayEvent::query()->insertOrIgnore([
                'uuid' => (string) Str::uuid(),
                'contour' => SafeDealGatewayContour::Ie->value,
                'event_type' => $eventType,
                'safe_deal_id' => $deal?->id ?? $incoming->safe_deal_id,
                'incoming_payment_id' => $incoming->id,
                'idempotency_key' => $eventType.':'.$incoming->id.':'.md5(json_encode($payload) ?: ''),
                'payload' => json_encode($payload),
                'processed_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (Throwable $e) {
            Log::warning('SafeDeal: gateway event not journalled', [
                'incoming' => $incoming->id,
                'event' => $eventType,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /** @param array<string, string> $params */
    private function appendQuery(string $url, array $params): string
    {
        return $url.(str_contains($url, '?') ? '&' : '?').http_build_query($params);
    }
}
