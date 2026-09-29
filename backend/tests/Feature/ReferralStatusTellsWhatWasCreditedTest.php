<?php

namespace Tests\Feature;

use App\Enums\ReferralStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Referral;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\ReferralProgramConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Services\ReferralService;
use Tests\TestCase;

/**
 * Приглашение говорит, что по нему начислено, а не только что оно закрыто.
 *
 * ЧТО БЫЛО НЕ ТАК. Подпись у закрытого приглашения — «Бонус начислен» —
 * бралась из одного лишь статуса. А статус `completed` ставится и тогда,
 * когда баллов не дали:
 *
 *   предел `max_paid_invites` исчерпан — приглашение закрывают с `points = 0`;
 *   тот же телефон уже приносил награду — закрывают, чтобы не висело.
 *
 * Оба случая завела правка 28.09, и оба она же и скрыла: человек читает
 * «Бонус начислен», а баланс не растёт. Объяснить разницу нечем — числа на
 * странице нет.
 *
 * Админ не видел этого вовсе: `points` в его список не отдавали, то есть
 * предел, который он сам же выставил, в таблице не проявлялся никак.
 */
class ReferralStatusTellsWhatWasCreditedTest extends TestCase
{
    use RefreshDatabase;

    /** @param array<string, mixed> $значения */
    private function настройки(array $значения = []): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => ReferralProgramConfig::SETTING_KEY],
            [
                'value' => ReferralProgramConfig::normalize(array_merge([
                    'enabled' => true,
                    'points_per_invite' => 100,
                    'max_paid_invites' => 0,
                ], $значения)),
                'group' => 'marketing',
            ],
        );
    }

    private function человек(string $имя, ?string $телефон = null, UserRole $role = UserRole::User): User
    {
        $user = User::factory()->create([
            'role' => $role,
            'status' => UserStatus::Active,
            'name' => $имя,
            'phone' => $телефон,
            'email_verified_at' => now(),
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => Str::slug($имя).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function приглашённыйСПодтверждённымТелефоном(User $inviter, string $телефон, string $имя): User
    {
        $invitee = $this->человек($имя, $телефон);
        $invitee->forceFill(['referred_by' => $inviter->id])->save();
        $invitee = $invitee->fresh();
        $invitee->forceFill(['phone_verified_at' => now()])->save();
        app(ReferralService::class)->onPhoneVerified($invitee->fresh());

        return $invitee->fresh();
    }

    /** @return array<int, array<string, mixed>> строки админского списка */
    private function админскийСписок(User $admin): array
    {
        return $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/referrals')
            ->assertOk()
            ->json('data');
    }

    public function test_оплаченное_приглашение_называет_начисленное(): void
    {
        /*
         * Контроль. Без него «ноль у неоплаченного» означал бы не отбор, а
         * колонку, в которой всегда ноль.
         */
        $this->настройки();
        $inviter = $this->человек('Пригласивший');
        $this->приглашённыйСПодтверждённымТелефоном($inviter, '+79990000011', 'Первый');

        $строка = $this->actingAs($inviter, 'sanctum')
            ->getJson('/api/v1/users/me/referrals')
            ->assertOk()
            ->json('data.invited.0');

        $this->assertSame('completed', $строка['status']);
        $this->assertSame(100, $строка['points'], 'страница не знает, сколько принесло приглашение');
    }

    public function test_приглашение_сверх_предела_не_выдаёт_себя_за_оплаченное(): void
    {
        $this->настройки(['max_paid_invites' => 1]);
        $inviter = $this->человек('Пригласивший');
        $this->приглашённыйСПодтверждённымТелефоном($inviter, '+79990000021', 'Первый');
        $this->приглашённыйСПодтверждённымТелефоном($inviter, '+79990000022', 'Второй');

        $строки = collect($this->actingAs($inviter, 'sanctum')
            ->getJson('/api/v1/users/me/referrals')
            ->assertOk()
            ->json('data.invited'));

        // Оба закрыты — статус одинаковый, и различить их можно только числом.
        $this->assertSame(['completed', 'completed'], $строки->pluck('status')->sort()->values()->all());
        $this->assertSame([0, 100], $строки->pluck('points')->sort()->values()->all());
    }

    public function test_админский_список_отдаёт_начисленное(): void
    {
        $this->настройки(['max_paid_invites' => 1]);
        $admin = $this->человек('Владелец', null, UserRole::Owner);
        $inviter = $this->человек('Пригласивший');
        $this->приглашённыйСПодтверждённымТелефоном($inviter, '+79990000031', 'Первый');
        $this->приглашённыйСПодтверждённымТелефоном($inviter, '+79990000032', 'Второй');

        $баллы = collect($this->админскийСписок($admin))->pluck('points')->sort()->values()->all();

        $this->assertSame(
            [0, 100],
            $баллы,
            'админ не видит, что предел, который он сам выставил, сработал',
        );
    }

    public function test_админский_список_помнит_старую_награду_размещением(): void
    {
        /*
         * До 28.09 награда была одним размещением, и в строке приглашения
         * лежит `listing_credits`, а не баллы. Такое приглашение тоже
         * оплачено — просто не баллами, и админ должен это видеть.
         */
        $this->настройки();
        $admin = $this->человек('Владелец', null, UserRole::Owner);
        $inviter = $this->человек('Пригласивший');
        $invitee = $this->человек('Давний друг', '+79990000041');
        $invitee->forceFill([
            'referred_by' => $inviter->id,
            'phone_verified_at' => now()->subMonths(2),
        ])->save();

        Referral::query()->create([
            'inviter_id' => $inviter->id,
            'invitee_id' => $invitee->id,
            'status' => ReferralStatus::Completed,
            'points' => 0,
            'listing_credits' => 1,
            'completed_at' => now()->subMonths(2),
        ]);

        $строка = collect($this->админскийСписок($admin))
            ->firstWhere('invitee.uuid', $invitee->uuid);

        $this->assertNotNull($строка, 'приглашение не попало в список');
        $this->assertSame(0, $строка['points']);
        $this->assertSame(1, $строка['listing_credits'], 'админ не видит, чем оплачено старое приглашение');
    }

    public function test_старая_награда_днями_подписки_тоже_видна(): void
    {
        /*
         * Третий канал. Прежний код писал `subscription_days` тем же
         * update, что и `listing_credits` — и в строке могли стоять оба.
         * Не отдать их наружу значило бы повторить исходный дефект: «Без
         * начисления» там, где начислено.
         */
        $this->настройки();
        $admin = $this->человек('Владелец', null, UserRole::Owner);
        $inviter = $this->человек('Пригласивший');
        $invitee = $this->человек('Друг с подпиской', '+79990000051');
        $invitee->forceFill([
            'referred_by' => $inviter->id,
            'phone_verified_at' => now()->subMonths(2),
        ])->save();

        Referral::query()->create([
            'inviter_id' => $inviter->id,
            'invitee_id' => $invitee->id,
            'status' => ReferralStatus::Completed,
            'points' => 0,
            'listing_credits' => 0,
            'subscription_days' => 30,
            'completed_at' => now()->subMonths(2),
        ]);

        $строка = collect($this->админскийСписок($admin))
            ->firstWhere('invitee.uuid', $invitee->uuid);

        $this->assertSame(30, $строка['subscription_days'], 'админ не видит награду днями подписки');

        $своя = collect($this->actingAs($inviter, 'sanctum')
            ->getJson('/api/v1/users/me/referrals')
            ->assertOk()
            ->json('data.invited'))
            ->firstWhere('user.uuid', $invitee->uuid);

        $this->assertSame(30, $своя['subscription_days'], 'страница приглашений не видит ту же награду');
    }
}
