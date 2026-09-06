<?php

namespace Modules\Billing\Services;

use App\Enums\SafeDealIncomingStatus;
use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;
use App\Models\SafeDealIncomingPayment;
use Illuminate\Support\Facades\Log;

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
