<?php

namespace App\Console\Commands;

use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;
use Illuminate\Console\Command;
use Modules\Billing\Services\SafeDealService;

class AutoReleaseSafeDealsCommand extends Command
{
    protected $signature = 'safe-deals:auto-release';

    protected $description = 'Release funds to sellers for delivered safe deals past their auto-release window';

    public function handle(SafeDealService $deals): int
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

        $this->info("Auto-released {$count} safe deal(s).");

        return self::SUCCESS;
    }
}
