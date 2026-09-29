<?php

namespace Modules\Billing\Services;

use App\Enums\ReferralStatus;
use App\Models\BonusTransaction;
use App\Models\Referral;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Services\Sms\SmsMessenger;
use App\Services\Sms\SmsTemplate;
use App\Support\Plural;
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

    /**
     * Награда за приглашённого — после подтверждения им телефона.
     *
     * Не при переходе по ссылке и не при регистрации: клик считается
     * отдельно (`TrackReferralClickController`) и награды не даёт, иначе
     * акцию накрутили бы за вечер.
     *
     * Три замка от повторного начисления, и каждый закрывает своё:
     *
     *   `referrals.invitee_id` уникален            — один приглашённый, одна строка;
     *   статус `completed` под `lockForUpdate`     — два одновременных подтверждения;
     *   отметка по телефону в отдельной таблице    — удалил учётку и завёлся заново.
     *
     * Третий добавлен 28.09. Первые два привязаны к учётной записи, а она
     * удаляется вместе со строкой `referrals` каскадом — и тот же телефон
     * приносил награду сколько угодно раз.
     */
    public function onPhoneVerified(User $invitee): void
    {
        if (! $invitee->referred_by || ! $invitee->phone_verified_at) {
            return;
        }

        $config = ReferralProgramConfig::get();
        if (! $config['enabled'] || $config['points_per_invite'] <= 0) {
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

            $отпечаток = self::phoneHash($invitee->phone);

            /*
             * Телефон уже приносил награду — значит это та же рука с той же
             * симкой, просто с новой учёткой. Приглашение закрываем, чтобы
             * оно не висело в ожидании, но баллов не даём.
             */
            $повтор = $отпечаток !== null && DB::table('referral_phone_awards')
                ->where('phone_hash', $отпечаток)
                ->exists();

            $предел = (int) $config['max_paid_invites'];
            $оплачено = Referral::query()
                ->where('inviter_id', $referrer->id)
                ->where('status', ReferralStatus::Completed)
                ->where('points', '>', 0)
                ->count();
            $исчерпан = $предел > 0 && $оплачено >= $предел;

            $points = ($повтор || $исчерпан) ? 0 : (int) $config['points_per_invite'];

            if ($points > 0) {
                app(BonusPointsService::class)->credit(
                    $referrer,
                    $points,
                    BonusPointsService::TYPE_REFERRAL,
                    'Баллы за приглашённого друга',
                    $invitee,
                    'referral:'.$referrer->id.':'.$invitee->id,
                );

                if ($отпечаток !== null) {
                    DB::table('referral_phone_awards')->insertOrIgnore([
                        'phone_hash' => $отпечаток,
                        'awarded_at' => now(),
                    ]);
                }
            }

            $row->update([
                'status' => ReferralStatus::Completed,
                'points' => $points,
                'completed_at' => now(),
            ]);

            if ($points > 0) {
                $this->notifyReferrer($referrer->fresh(), $invitee, $points);
            }
        });
    }

    /**
     * Отпечаток телефона: только цифры, затем sha256.
     *
     * Нормализация обязательна — один и тот же номер приходит как
     * `+7 999 …` и `8999…`, и без неё отметка не нашлась бы. Хеш, а не сам
     * номер: сверяем равенство, и держать телефоны россыпью в служебной
     * таблице незачем.
     */
    public static function phoneHash(?string $phone): ?string
    {
        $цифры = preg_replace('/\D+/', '', (string) $phone) ?? '';
        if ($цифры === '') {
            return null;
        }
        // 8XXXXXXXXXX и 7XXXXXXXXXX — один и тот же номер.
        if (strlen($цифры) === 11 && $цифры[0] === '8') {
            $цифры = '7'.substr($цифры, 1);
        }

        return hash('sha256', $цифры);
    }

    /**
     * Сколько баллов человек заработал приглашениями.
     *
     * Считается по проводкам, а не по балансу: баланс уменьшается при
     * тратах, а вопрос на странице — «сколько я заработал».
     */
    public function referralPointsEarned(int $userId): int
    {
        return (int) BonusTransaction::query()
            ->where('account_user_id', $userId)
            ->where('type', BonusPointsService::TYPE_REFERRAL)
            ->where('amount', '>', 0)
            ->sum('amount');
    }

    /** @return array{clicks: int, registered: int, verified: int, points: int} */
    public function dashboard(User $user): array
    {
        return [
            'clicks' => (int) $user->referral_click_count,
            'registered' => Referral::query()->where('inviter_id', $user->id)->count(),
            'verified' => Referral::query()->where('inviter_id', $user->id)->where('status', ReferralStatus::Completed)->count(),
            'points' => $this->referralPointsEarned($user->id),
        ];
    }

    private function notifyReferrer(User $referrer, User $invitee, int $points): void
    {
        $name = $invitee->profile?->display_name ?? $invitee->name ?? 'друг';
        $reward = '+'.$points.' '.Plural::баллы($points);

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
