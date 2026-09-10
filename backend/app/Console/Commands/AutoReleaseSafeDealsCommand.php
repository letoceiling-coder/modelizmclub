<?php

namespace App\Console\Commands;

use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;
use Illuminate\Console\Command;
use Modules\Billing\Services\SafeDealHoldSyncService;
use Modules\Billing\Services\SafeDealPayoutService;
use Modules\Billing\Services\SafeDealService;

class AutoReleaseSafeDealsCommand extends Command
{
    protected $signature = 'safe-deals:auto-release';

    protected $description = 'Release funds to sellers for delivered safe deals past their auto-release window, drive pending SBP payouts, and free listings held by abandoned checkouts';

    public function handle(SafeDealService $deals, SafeDealHoldSyncService $holds, SafeDealPayoutService $payouts): int
    {
        $due = SafeDeal::query()
            ->where('status', SafeDealStatus::Delivered->value)
            ->whereNotNull('auto_release_at')
            ->where('auto_release_at', '<=', now())
            ->get();

        $count = 0;
        foreach ($due as $deal) {
            $deals->autoRelease($deal);
            $count++;
        }

        $expired = $holds->expireStaleCheckouts();

        // Сделки в `paid` держатся на авторизации в банке, а её могут снять
        // без нас. Опрос идёт здесь, а не отдельной командой: это тот же
        // сторож холдов, что гасит брошенные чекауты, и лимит частоты у
        // банка на них общий.
        $polled = ['polled' => 0, 'held' => 0, 'lost' => 0, 'failed' => 0];
        $recovered = ['checked' => 0, 'recovered' => 0, 'failed' => 0];
        if (config('billing.auto_poll.holds.enabled', true)) {
            $polled = $holds->syncActiveHolds();
            // Строки, потерявшие номер заказа между ответом банка и записью.
            // Опрос выше их не видит — у него whereNotNull('rbs_order_id').
            $recovered = $holds->recoverLostOrderIds();
        }

        // SBP payouts move APPROVED → CONFIRMED → PAID out of band; callbacks
        // are best-effort, so poll anything still in flight.
        $advanced = 0;
        if ($payouts->enabled()) {
            foreach ($payouts->pending() as $payout) {
                $payouts->advance($payout);
                $advanced++;
            }
        }

        $this->info("Auto-released {$count} safe deal(s); expired {$expired} abandoned checkout(s); advanced {$advanced} payout(s).");
        $this->info(sprintf(
            'Опрошено холдов: %d (в силе %d, снято банком %d, опрос не удался %d).',
            $polled['polled'],
            $polled['held'],
            $polled['lost'],
            $polled['failed'],
        ));

        if ($recovered['checked'] > 0) {
            $this->info(sprintf(
                'Проверено холдов без номера заказа: %d (восстановлено %d, опрос не удался %d).',
                $recovered['checked'],
                $recovered['recovered'],
                $recovered['failed'],
            ));
        }

        if ($polled['lost'] > 0) {
            $this->warn(
                'Есть сделки, по которым банк снял удержание. Денежные развязки по ним остановлены — разберитесь вручную.',
            );
        }

        return self::SUCCESS;
    }
}
