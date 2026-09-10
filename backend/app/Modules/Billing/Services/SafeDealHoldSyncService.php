<?php

namespace Modules\Billing\Services;

use App\Enums\SafeDealIncomingStatus;
use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;
use App\Models\SafeDealIncomingPayment;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Reconciles a VTB hold with the deal it backs.
 *
 * Sits between {@see SafeDealSettlementService} (bank calls) and
 * {@see SafeDealService} (deal lifecycle) so neither has to know about the
 * other, and so webhooks, the buyer's return from the payment form and the
 * scheduled sweeper can all share one code path.
 */
class SafeDealHoldSyncService
{
    public function __construct(
        private readonly SafeDealSettlementService $settlement,
        private readonly SafeDealService $deals,
    ) {}

    public function syncByRbsOrderId(string $orderId): ?SafeDeal
    {
        $incoming = $this->settlement->findByRbsOrderId($orderId);

        if ($incoming === null) {
            Log::warning('SafeDeal VTB: unknown order id', ['orderId' => $orderId]);

            return null;
        }

        return $this->sync($incoming);
    }

    /** Pulls the live status and moves the deal along if the hold landed. */
    public function sync(SafeDealIncomingPayment $incoming): ?SafeDeal
    {
        $incoming = $this->settlement->syncHold($incoming);
        $deal = $incoming->safeDeal ?? SafeDeal::query()->find($incoming->safe_deal_id);

        if ($deal === null) {
            return null;
        }

        return match ($incoming->status) {
            SafeDealIncomingStatus::Authorized,
            SafeDealIncomingStatus::Captured => $this->deals->markHoldAuthorized($deal),
            SafeDealIncomingStatus::Failed,
            SafeDealIncomingStatus::Reversed => $this->deals->expireCheckout($deal, 'Банк отклонил оплату.'),
            default => $deal,
        };
    }

    /**
     * Опрос банка по сделкам, которые считаются оплаченными.
     *
     * Холд — не вечное состояние. Банк снимает авторизацию по сроку жизни,
     * её отменяют из кабинета, одностадийный платёж возвращают. Узнать об
     * этом площадке было неоткуда: колбэк приходит не всегда, а спрашивать
     * банк по сделке в `paid` не приходило в голову никому — до самой
     * выплаты продавцу деньги считались удержанными.
     *
     * Команда ничего не решает за человека. Сделку она не трогает: снять
     * отгруженную сделку с рейсов из-за ответа банка — решение не машинное.
     * Что она делает — приводит запись о холде в соответствие с банком, и
     * этого достаточно: после такой записи денежные развязки по сделке
     * останавливаются сами ({@see SafeDealService::assertHoldUsable}), а
     * расхождение видно в логе и в журнале событий шлюза.
     *
     * Темп берётся оттуда же, откуда у разбора висящих платежей: у банка
     * один лимит частоты на всех, и два разных представления о нём рано или
     * поздно разойдутся.
     *
     * @return array{polled: int, held: int, lost: int, failed: int}
     */
    public function syncActiveHolds(?int $olderThanMinutes = null, ?int $limit = null): array
    {
        $result = ['polled' => 0, 'held' => 0, 'lost' => 0, 'failed' => 0];

        if (! $this->settlement->vtbConfigured()) {
            return $result;
        }

        $olderThan = max(0, $olderThanMinutes ?? (int) config('billing.auto_poll.holds.older_than_minutes', 60));
        $limit = max(1, $limit ?? (int) config('billing.auto_poll.holds.limit', 50));
        $delayMs = max(0, (int) config('billing.vtb.reconcile.delay_ms', 1000));

        /*
         * `updated_at` строки холда — это время последнего ответа банка:
         * `applyRbsOrderStatus` всегда пишет `last_callback_at`. Отбор по
         * нему и есть защита от частых повторов: каждый холд опрашивается не
         * чаще, чем раз в `older_than_minutes`, сколько бы раз ни сработало
         * расписание.
         */
        $rows = SafeDealIncomingPayment::query()
            ->whereIn('status', [
                SafeDealIncomingStatus::Pending,
                SafeDealIncomingStatus::Authorized,
            ])
            ->whereNotNull('rbs_order_id')
            ->where('updated_at', '<=', now()->subMinutes($olderThan))
            ->whereHas('safeDeal', fn ($q) => $q->where('status', SafeDealStatus::Paid->value))
            ->orderBy('updated_at')
            ->limit($limit)
            ->get();

        foreach ($rows as $index => $incoming) {
            if ($index > 0 && $delayMs > 0) {
                usleep($delayMs * 1000);
            }

            $result['polled']++;

            try {
                $fresh = $this->settlement->syncHold($incoming);
            } catch (Throwable $e) {
                // Сбой опроса — не ответ. Состояние холда осталось
                // неизвестным, и трогать его нельзя: закрыть сделку из-за
                // своей же сетевой ошибки хуже, чем не узнать ничего.
                $result['failed']++;
                Log::warning('SafeDeal hold poll failed', [
                    'incoming' => $incoming->uuid,
                    'deal' => $incoming->safe_deal_id,
                    'exception' => $e->getMessage(),
                ]);

                continue;
            }

            if (in_array($fresh->status, [
                SafeDealIncomingStatus::Reversed,
                SafeDealIncomingStatus::Refunded,
                SafeDealIncomingStatus::Failed,
            ], true)) {
                $result['lost']++;
                Log::error('SafeDeal hold is gone at the bank', [
                    'deal' => $fresh->safeDeal?->uuid,
                    'incoming' => $fresh->uuid,
                    'status' => $fresh->status->value,
                    'rbs_order_status' => $fresh->rbs_order_status,
                ]);

                continue;
            }

            $result['held']++;
        }

        return $result;
    }

    /**
     * Подобрать заказы, номер которых до нас не доехал.
     *
     * Опрос холдов выше берёт только строки с `rbs_order_id` — иначе спрашивать
     * банк не о чем. Значит строка, потерявшая номер между ответом банка и
     * записью, не попадает ни под один регулярный проход: ни под опрос, ни под
     * захват, ни под возврат. Деньги на карте покупателя при этом могут быть
     * заморожены.
     *
     * Транзакция в `openHold` закрывает окно на будущее, но не помогает тем
     * строкам, что уже есть, и не помогает при падении между ответом банка и
     * началом транзакции — окно сузилось, но не исчезло. Здесь оно
     * закрывается с другой стороны: у банка спрашивают по `orderNumber`,
     * которым мы владеем всегда.
     *
     * Отбор по возрасту: строка младше окна может быть просто открытой формой
     * оплаты, где покупатель ещё вводит карту.
     *
     * @return array{checked: int, recovered: int, failed: int}
     */
    public function recoverLostOrderIds(?int $olderThanMinutes = null, ?int $limit = null): array
    {
        $result = ['checked' => 0, 'recovered' => 0, 'failed' => 0];

        if (! $this->settlement->vtbConfigured()) {
            return $result;
        }

        $olderThan = max(1, $olderThanMinutes ?? (int) config('billing.auto_poll.holds.recover_older_than_minutes', 15));
        $limit = max(1, $limit ?? (int) config('billing.auto_poll.holds.limit', 50));
        $delayMs = max(0, (int) config('billing.vtb.reconcile.delay_ms', 1000));

        foreach ($this->settlement->pendingWithoutOrderId($olderThan, $limit) as $index => $incoming) {
            if ($index > 0 && $delayMs > 0) {
                usleep($delayMs * 1000);
            }

            $result['checked']++;

            try {
                $fresh = $this->settlement->recoverOrderId($incoming);
            } catch (Throwable $e) {
                $result['failed']++;
                Log::warning('SafeDeal: order id recovery failed', [
                    'incoming' => $incoming->uuid,
                    'exception' => $e->getMessage(),
                ]);

                continue;
            }

            if ($fresh->rbs_order_id) {
                $result['recovered']++;
                Log::error('SafeDeal: order id recovered from the bank by orderNumber', [
                    'incoming' => $fresh->uuid,
                    'deal' => $fresh->safe_deal_id,
                    'rbs_order_id' => $fresh->rbs_order_id,
                ]);
            }
        }

        return $result;
    }

    /**
     * Sweeps deals whose buyer never finished the card form.
     *
     * @return int Number of deals released
     */
    public function expireStaleCheckouts(): int
    {
        $ttl = max(5, (int) config('billing.safe_deal.checkout_ttl_minutes', 30));

        $stale = SafeDeal::query()
            ->where('status', SafeDealStatus::Created)
            ->where('created_at', '<', now()->subMinutes($ttl))
            ->get();

        $released = 0;

        foreach ($stale as $deal) {
            $incoming = $deal->activeIncomingPayment();

            // The buyer may have paid just as the window closed — trust the bank.
            if ($incoming !== null) {
                $this->sync($incoming);
                $after = $deal->fresh()?->status;

                if ($after !== SafeDealStatus::Created) {
                    // Сверка сама увела сделку из `created`. Если она её
                    // погасила — это тот же результат, и он должен попасть в
                    // счётчик: до 07.09 `continue` стоял до `$released++`, и
                    // прогон, погасивший четыре сделки, отчитывался «expired 0».
                    // Оператор по такому логу решает, что делать было нечего.
                    if ($after === SafeDealStatus::Cancelled) {
                        $released++;
                    }

                    continue;
                }
            }

            $this->deals->expireCheckout($deal);
            $released++;
        }

        return $released;
    }
}
