<?php

namespace Modules\Billing\Services;

use App\Enums\WalletTransactionType;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserSubscription;
use App\Support\FirstHundredPromo;
use Illuminate\Support\Facades\DB;

class FirstHundredService
{
    public function __construct(
        private readonly PaymentFulfillmentService $payments,
        private readonly WalletService $wallet,
    ) {}

    /**
     * Grant or revoke the promo year according to the admin setting.
     * Returns true only when a new promo seat was assigned.
     */
    public function tryGrant(User $user): bool
    {
        return DB::transaction(function () use ($user): bool {
            $this->lockSettings();
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->first();

            if (! $locked) {
                return false;
            }

            if ($locked->is_first_hundred) {
                $this->syncFlaggedUser($locked);

                return false;
            }

            $config = FirstHundredPromo::get();
            if (! $config['enabled'] || FirstHundredPromo::takenCount() >= $config['total']) {
                return false;
            }

            $plan = $this->resolvePlan($config['plan_slug']);
            if (! $plan) {
                return false;
            }

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

            $this->ensurePromoSubscription($locked->fresh(), $plan);

            return true;
        });
    }

    /** Re-apply admin limits for a user who already holds a promo seat. */
    public function syncUser(User $user): void
    {
        if (! $user->is_first_hundred) {
            return;
        }

        DB::transaction(function () use ($user): void {
            $this->lockSettings();
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->first();

            if ($locked?->is_first_hundred) {
                $this->syncFlaggedUser($locked);
            }
        });
    }

    /** Apply current admin limits to every promo user (enable/disable and quota). */
    public function reconcileAll(): void
    {
        DB::transaction(function (): void {
            $this->lockSettings();
            $config = FirstHundredPromo::get();
            $plan = $this->resolvePlan($config['plan_slug']);

            $users = User::query()
                ->where('is_first_hundred', true)
                ->orderBy('first_hundred_granted_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $kept = 0;
            foreach ($users as $promoUser) {
                $keep = $config['enabled'] && $plan !== null && $kept < $config['total'];
                if ($keep) {
                    $this->ensurePromoSubscription($promoUser, $plan);
                    $kept++;
                } else {
                    $this->cancelUnpaidPromoSubscription($promoUser);
                }
            }
        });
    }

    private function syncFlaggedUser(User $user): void
    {
        $config = FirstHundredPromo::get();
        $plan = $this->resolvePlan($config['plan_slug']);

        if ($config['enabled'] && $plan && FirstHundredPromo::coversUser($user)) {
            $this->ensurePromoSubscription($user, $plan);

            return;
        }

        $this->cancelUnpaidPromoSubscription($user);
    }

    private function ensurePromoSubscription(User $user, SubscriptionPlan $plan): void
    {
        $active = UserSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->exists();

        if ($active) {
            return;
        }

        $cancelled = UserSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'cancelled')
            ->where('ends_at', '>', now())
            ->latest('id')
            ->first();

        if ($cancelled) {
            $cancelled->update([
                'status' => 'active',
                'cancelled_at' => null,
                'auto_renew' => false,
            ]);

            return;
        }

        $subscription = $this->payments->activateSubscription($user, (int) $plan->id);
        $subscription->update(['auto_renew' => false]);
    }

    private function cancelUnpaidPromoSubscription(User $user): void
    {
        if ($user->hasPaidSubscriptionPayment()) {
            return;
        }

        UserSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'auto_renew' => false,
            ]);
    }

    private function resolvePlan(string $slug): ?SubscriptionPlan
    {
        $plan = SubscriptionPlan::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if ($plan) {
            return $plan;
        }

        return SubscriptionPlan::query()
            ->where('is_active', true)
            ->orderByDesc('period_days')
            ->first();
    }

    private function lockSettings(): void
    {
        SystemSetting::query()->firstOrCreate(
            ['key' => FirstHundredPromo::SETTING_KEY],
            ['value' => FirstHundredPromo::defaults(), 'group' => 'marketing'],
        );

        SystemSetting::query()
            ->where('key', FirstHundredPromo::SETTING_KEY)
            ->lockForUpdate()
            ->first();
    }
}
