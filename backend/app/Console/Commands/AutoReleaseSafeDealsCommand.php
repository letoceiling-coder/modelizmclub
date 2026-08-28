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

        return self::SUCCESS;
    }
}
