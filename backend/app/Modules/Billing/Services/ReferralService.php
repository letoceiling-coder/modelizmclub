<?php

namespace Modules\Billing\Services;

use App\Models\BonusAccount;
use App\Models\BonusTransaction;
use App\Models\User;
use App\Services\Sms\SmsMessenger;
use App\Services\Sms\SmsTemplate;
use App\Support\ReferralProgramConfig;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReferralService
{
    public function onUserRegistered(User $invitee): void
    {
        if (! $invitee->referred_by) {
            return;
        }

        $referrer = User::query()->find($invitee->referred_by);

        if (! $referrer) {
            return;
        }

        $config = ReferralProgramConfig::get();

        if (! $config['enabled']) {
            return;
        }

        DB::transaction(function () use ($referrer, $invitee, $config): void {
            $lockedReferrer = User::query()->whereKey($referrer->id)->lockForUpdate()->first();

            if (! $lockedReferrer) {
                return;
            }

            $earned = $this->referralCreditsEarned($lockedReferrer->id);
            $cap = $config['max_bonus'];
            $grant = min($config['per_invite'], max(0, $cap - $earned));

            if ($grant <= 0) {
                return;
            }

            $lockedReferrer->increment('listing_placement_credits', $grant);

            BonusAccount::query()->firstOrCreate(
                ['user_id' => $lockedReferrer->id],
                ['balance' => 0],
            );

            BonusTransaction::query()->create([
                'account_user_id' => $lockedReferrer->id,
                'amount' => $grant,
                'type' => 'referral',
                'source_type' => User::class,
                'source_id' => $invitee->id,
                'description' => 'Бонус за приглашение друга',
                'created_at' => now(),
            ]);

            $this->notifyReferrer($lockedReferrer, $invitee, $grant);
        });
    }

    public function referralCreditsEarned(int $userId): int
    {
        return (int) BonusTransaction::query()
            ->where('account_user_id', $userId)
            ->where('type', 'referral')
            ->where('amount', '>', 0)
            ->sum('amount');
    }

    private function notifyReferrer(User $referrer, User $invitee, int $grant): void
    {
        if (! $referrer->phone || ! $referrer->phone_verified_at) {
            return;
        }

        try {
            app(SmsMessenger::class)->sendTemplate(
                $referrer->phone,
                SmsTemplate::ReferralReward,
                [
                    $invitee->profile?->display_name ?? $invitee->name ?? 'друг',
                    "+{$grant} ".($grant === 1 ? 'объявление' : 'объявления'),
                ],
            );
        } catch (\Throwable $e) {
            Log::warning('Referral SMS skipped', [
                'referrer_id' => $referrer->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
