<?php

namespace Modules\Billing\Services;

use App\Enums\WalletTransactionType;
use App\Models\PromoPool;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserSubscription;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Support\FirstHundredPromo;
use DateTimeInterface;
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
            $pool = \Illuminate\Support\Facades\Schema::hasTable('promo_pools')
                ? PromoPool::query()->granting()->lockForUpdate()->first()
                : null;

            if ($pool && $pool->seatsLeft() > 0) {
                return $this->grantFromPool($locked, $pool);
            }

            if (! $config['enabled'] || FirstHundredPromo::takenCount() >= $config['total']) {
                return false;
            }

            $plan = $this->resolvePlan($config['plan_slug']);
            if (! $plan) {
                return false;
            }

            $this->creditWelcomeBonus($locked, (int) ($config['bonus_kopecks'] ?? 0), 'Бонус «Первые 100»');

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

    private function grantFromPool(User $user, PromoPool $pool): bool
    {
        $plan = $this->resolvePlan((string) $pool->plan_slug);
        if (! $plan) {
            return false;
        }

        $this->creditWelcomeBonus($user, (int) $pool->bonus_kopecks, 'Бонус «'.$pool->name.'»');

        $user->forceFill([
            'is_first_hundred' => true,
            'first_hundred_granted_at' => now(),
            'promo_pool_id' => $pool->id,
        ])->save();

        $this->ensurePromoSubscription($user->fresh(), $plan, $pool->expires_at);
        $pool->increment('current_activations');

        return true;
    }

    private function creditWelcomeBonus(User $user, int $bonusKopecks, string $note): void
    {
        if ($bonusKopecks <= 0) {
            return;
        }

        $this->wallet->credit(
            $user,
            $bonusKopecks,
            WalletTransactionType::PromoBonus,
            $note,
            'promo_first_hundred',
            $user->id,
            'first-hundred:'.$user->id,
        );
    }

    public function extendSubscription(User $user, int $days): void
    {
        if ($days <= 0) {
            return;
        }

        $active = UserSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->latest('id')
            ->first();

        if ($active) {
            $from = $active->ends_at && $active->ends_at->gt(now()) ? $active->ends_at->copy() : now();
            $active->update(['ends_at' => $from->addDays($days)]);

            return;
        }

        $plan = $this->resolvePlan('year');
        if (! $plan) {
            return;
        }

        $this->ensurePromoSubscription($user, $plan, now()->addDays($days));
    }

    /** Soft-expire unpaid promo subscriptions past ends_at and ping the user. */
    public function expireEndedPromoSubscriptions(): int
    {
        $rows = UserSubscription::query()
            ->where('status', 'active')
            ->whereNotNull('ends_at')
            ->where('ends_at', '<=', now())
            ->get();

        $count = 0;
        foreach ($rows as $row) {
            $user = $row->user;
            if (! $user || $user->hasPaidSubscriptionPayment()) {
                continue;
            }

            $row->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'auto_renew' => false,
            ]);

            InAppNotify::sendQuiet(
                $user,
                new InAppNotification(
                    'promo',
                    'Промо-подписка закончилась',
                    'Продлите тариф, чтобы сохранить доступ к платным функциям клуба.',
                    '/subscription',
                ),
            );
            $count++;
        }

        return $count;
    }

    private function syncFlaggedUser(User $user): void
    {
        $config = FirstHundredPromo::get();
        $plan = $this->resolvePlan($config['plan_slug']);

        if ($user->promo_pool_id) {
            $pool = PromoPool::query()->find($user->promo_pool_id);
            $poolPlan = $pool ? $this->resolvePlan((string) $pool->plan_slug) : null;
            // Pause/complete stop new grants only — existing seats stay until ends_at.
            if ($pool && ($poolPlan ?? $plan)) {
                $this->ensurePromoSubscription($user, $poolPlan ?? $plan, $pool->expires_at);

                return;
            }
        }

        if ($config['enabled'] && $plan && FirstHundredPromo::coversUser($user)) {
            $this->ensurePromoSubscription($user, $plan);

            return;
        }

        $this->cancelUnpaidPromoSubscription($user);
    }

    private function ensurePromoSubscription(User $user, SubscriptionPlan $plan, ?DateTimeInterface $endsAt = null): void
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

        $subscription = $this->payments->activateSubscription($user, (int) $plan->id, $endsAt);
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
