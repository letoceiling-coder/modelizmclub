<?php

namespace Modules\Billing\Services;

use App\Enums\ReferralStatus;
use App\Enums\WalletTransactionType;
use App\Models\BonusAccount;
use App\Models\BonusTransaction;
use App\Models\Referral;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Services\Sms\SmsMessenger;
use App\Services\Sms\SmsTemplate;
use App\Support\ReferralProgramConfig;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReferralService
{
    public function __construct(
        private readonly FirstHundredService $promo,
    ) {}

    public function findReferrerByCode(?string $code): ?User
    {
        $code = strtoupper(trim((string) $code));
        if ($code === '') {
            return null;
        }

        return User::query()->whereRaw('upper(referral_code) = ?', [$code])->first();
    }

    public function recordClick(string $code): void
    {
        $referrer = $this->findReferrerByCode($code);
        if (! $referrer) {
            return;
        }

        $referrer->increment('referral_click_count');
    }

    /** Bind invitee to referrer at registration. Bonus waits for phone verification. */
    public function onUserRegistered(User $invitee): void
    {
        if (! $invitee->referred_by) {
            return;
        }

        $config = ReferralProgramConfig::get();
        if (! $config['enabled']) {
            return;
        }

        DB::transaction(function () use ($invitee): void {
            Referral::query()->firstOrCreate(
                ['invitee_id' => $invitee->id],
                [
                    'inviter_id' => $invitee->referred_by,
                    'status' => ReferralStatus::Pending,
                ],
            );
        });

        if ($invitee->phone_verified_at) {
            $this->onPhoneVerified($invitee->fresh());
        }
    }

    /** Attach a code after login (OAuth / late cookie) if the account is still young and unbound. */
    public function claimCode(User $invitee, string $code): bool
    {
        if ($invitee->referred_by) {
            return false;
        }

        if ($invitee->created_at && $invitee->created_at->lt(now()->subDays(30))) {
            return false;
        }

        $referrer = $this->findReferrerByCode($code);
        if (! $referrer || (int) $referrer->id === (int) $invitee->id) {
            return false;
        }

        $invitee->forceFill(['referred_by' => $referrer->id])->save();
        $this->onUserRegistered($invitee->fresh());

        return true;
    }

    public function onPhoneVerified(User $invitee): void
    {
        if (! $invitee->referred_by || ! $invitee->phone_verified_at) {
            return;
        }

        $config = ReferralProgramConfig::get();
        if (! $config['enabled']) {
            return;
        }

        DB::transaction(function () use ($invitee, $config): void {
            $row = Referral::query()
                ->where('invitee_id', $invitee->id)
                ->lockForUpdate()
                ->first();

            if ($row === null) {
                $row = Referral::query()->create([
                    'inviter_id' => $invitee->referred_by,
                    'invitee_id' => $invitee->id,
                    'status' => ReferralStatus::Pending,
                ]);
            }

            if ($row->status === ReferralStatus::Completed) {
                return;
            }

            $referrer = User::query()->whereKey($row->inviter_id)->lockForUpdate()->first();
            if (! $referrer) {
                return;
            }

            $listingGrant = 0;
            if ($config['reward_listing_credits'] && $config['per_invite'] > 0) {
                $earned = $this->referralCreditsEarned($referrer->id);
                $cap = $config['max_bonus'];
                $listingGrant = min($config['per_invite'], max(0, $cap - $earned));
                if ($listingGrant > 0) {
                    $referrer->increment('listing_placement_credits', $listingGrant);
                    BonusAccount::query()->firstOrCreate(
                        ['user_id' => $referrer->id],
                        ['balance' => 0],
                    );
                    BonusTransaction::query()->create([
                        'account_user_id' => $referrer->id,
                        'amount' => $listingGrant,
                        'type' => 'referral',
                        'source_type' => User::class,
                        'source_id' => $invitee->id,
                        'description' => 'Бонус за приглашение друга',
                        'created_at' => now(),
                    ]);
                }
            }

            $days = (int) $config['reward_subscription_days'];
            if ($days > 0) {
                $this->promo->extendSubscription($referrer, $days);
            }

            $rewardKopecks = (int) ($config['reward_kopecks'] ?? 0);
            if ($rewardKopecks > 0) {
                app(WalletService::class)->credit(
                    $referrer,
                    $rewardKopecks,
                    WalletTransactionType::ReferralBonus,
                    'Реферальный бонус за приглашение друга',
                    'referral',
                    $invitee->id,
                    'referral:'.$referrer->id.':'.$invitee->id,
                );
            }

            $row->update([
                'status' => ReferralStatus::Completed,
                'listing_credits' => $listingGrant,
                'subscription_days' => $days,
                'completed_at' => now(),
            ]);

            $this->notifyReferrer($referrer->fresh(), $invitee, $listingGrant, $days);
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

    /** @return array{clicks: int, registered: int, verified: int, listing_credits: int} */
    public function dashboard(User $user): array
    {
        return [
            'clicks' => (int) $user->referral_click_count,
            'registered' => Referral::query()->where('inviter_id', $user->id)->count(),
            'verified' => Referral::query()->where('inviter_id', $user->id)->where('status', ReferralStatus::Completed)->count(),
            'listing_credits' => $this->referralCreditsEarned($user->id),
        ];
    }

    private function notifyReferrer(User $referrer, User $invitee, int $listingGrant, int $days): void
    {
        $name = $invitee->profile?->display_name ?? $invitee->name ?? 'друг';
        $bits = [];
        if ($listingGrant > 0) {
            $bits[] = '+'.$listingGrant.' бесплатн'.($listingGrant === 1 ? 'ое объявление' : 'ых объявлений');
        }
        if ($days > 0) {
            $bits[] = '+'.$days.' дн. подписки';
        }
        $reward = $bits !== [] ? implode(' и ', $bits) : 'бонус';

        InAppNotify::sendQuiet(
            $referrer,
            new InAppNotification(
                'promo',
                'Друг подтвердил профиль',
                'Ваш друг '.$name.' подтвердил телефон. Вам начислено: '.$reward.'.',
                '/referral',
            ),
        );

        if (! $referrer->phone || ! $referrer->phone_verified_at) {
            return;
        }

        try {
            app(SmsMessenger::class)->sendTemplate(
                $referrer->phone,
                SmsTemplate::ReferralReward,
                [$name, $reward],
            );
        } catch (\Throwable $e) {
            Log::warning('Referral SMS skipped', [
                'referrer_id' => $referrer->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
