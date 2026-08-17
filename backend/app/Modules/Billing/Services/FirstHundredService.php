<?php

namespace Modules\Billing\Services;

use App\Enums\WalletTransactionType;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Support\FirstHundredPromo;
use Illuminate\Support\Facades\DB;

class FirstHundredService
{
    public function __construct(
        private readonly PaymentFulfillmentService $payments,
        private readonly WalletService $wallet,
    ) {}

    /** Grant a free year subscription to early registrants (once per user). */
    public function tryGrant(User $user): bool
    {
        if ($user->is_first_hundred) {
            return false;
        }

        $config = FirstHundredPromo::get();

        if (! $config['enabled']) {
            return false;
        }

        return DB::transaction(function () use ($user, $config): bool {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->first();

            if (! $locked || $locked->is_first_hundred) {
                return false;
            }

            if (FirstHundredPromo::takenCount() >= $config['total']) {
                return false;
            }

            $plan = SubscriptionPlan::query()
                ->where('slug', $config['plan_slug'])
                ->where('is_active', true)
                ->first();

            if (! $plan) {
                $plan = SubscriptionPlan::query()
                    ->where('is_active', true)
                    ->orderByDesc('period_days')
                    ->first();
            }

            if (! $plan) {
                return false;
            }

            $this->payments->activateSubscription($locked, (int) $plan->id);

            $bonusKopecks = (int) ($config['bonus_kopecks'] ?? 0);
            if ($bonusKopecks > 0) {
                $this->wallet->credit(
                    $locked,
                    $bonusKopecks,
                    WalletTransactionType::PromoBonus,
                    'Бонус «Первые 100»',
                    'promo_first_hundred',
                    $locked->id,
                    'first-hundred:'.$locked->id,
                );
            }

            $locked->forceFill([
                'is_first_hundred' => true,
                'first_hundred_granted_at' => now(),
            ])->save();

            return true;
        });
    }
}
