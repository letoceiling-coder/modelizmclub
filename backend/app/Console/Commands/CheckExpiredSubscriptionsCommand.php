<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Modules\Billing\Services\FirstHundredService;

class CheckExpiredSubscriptionsCommand extends Command
{
    protected $signature = 'subscription:check-expired';

    protected $description = 'Soft-cancel unpaid promo subscriptions past ends_at and notify users to renew';

    public function handle(FirstHundredService $promo): int
    {
        $count = $promo->expireEndedPromoSubscriptions();
        $this->info("Expired {$count} promo subscription(s).");

        return self::SUCCESS;
    }
}
