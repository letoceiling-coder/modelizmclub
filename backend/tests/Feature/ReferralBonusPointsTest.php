<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\BonusAccount;
use App\Models\Referral;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\ReferralProgramConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Billing\Services\BonusPointsService;
use Modules\Billing\Services\ReferralService;
use Modules\Legal\Services\UserAccountDeletionService;
use Tests\TestCase;

/**
 * Награда за приглашение — бонусные баллы, и накрутить её нельзя.
 *
 * До 28.09 награда была зашита тремя способами сразу: штуки размещений, дни
 * подписки и **настоящие деньги в кошелёк** (`reward_kopecks`, откуда есть
 * вывод). Бонусных баллов при этом не существовало вовсе: таблица
 * `bonus_accounts` стояла с самого начала, но `balance` всегда оставался
 * нулём — его не увеличивал ни один путь во всём `app/`.
 *
 * Теперь награда одна, и она не выводится деньгами.
 */
class ReferralBonusPointsTest extends TestCase
{
    use RefreshDatabase;

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
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => Str::slug($имя).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    /** Приглашённый: привязан к пригласившему, телефон ещё не подтверждён. */
    private function приглашённый(User $inviter, string $телефон, string $имя = 'Друг'): User
    {
        $user = $this->человек($имя, $телефон);
        $user->forceFill(['referred_by' => $inviter->id])->save();

        return $user->fresh();
    }

    private function подтвердитьТелефон(User $invitee): void
    {
        $invitee->forceFill(['phone_verified_at' => now()])->save();
        app(ReferralService::class)->onPhoneVerified($invitee->fresh());
    }

    private function баллы(User $user): int
    {
        return app(BonusPointsService::class)->balance($user->fresh());
    }

    public function test_баллы_начисляются_после_подтверждения_телефона(): void
    {
        $this->настройки();
        $inviter = $this->человек('Пригласивший');
        $invitee = $this->приглашённый($inviter, '+79990000001');

        // До подтверждения — ничего.
        $this->assertSame(0, $this->баллы($inviter), 'за регистрацию награды нет');

        $this->подтвердитьТелефон($invitee);

        $this->assertSame(100, $this->баллы($inviter));
        $this->assertSame(
            100,
            app(ReferralService::class)->referralPointsEarned($inviter->id),
            'заработанное считается отдельно от баланса',
        );
    }

    /**
     * Переход по ссылке награды не даёт.
     *
     * Это прямое требование: иначе акцию накрутили бы за вечер, открывая
     * ссылку с разных устройств.
     */
    public function test_переход_по_ссылке_не_начисляет(): void
    {
        $this->настройки();
        $inviter = $this->человек('Пригласивший');
        $inviter->ensureReferralCode();

        $this->postJson('/api/v1/referrals/click', ['code' => $inviter->fresh()->referral_code]);

        $this->assertSame(0, $this->баллы($inviter));
    }

    /** Повторное подтверждение телефона не начисляет второй раз. */
    public function test_повторное_подтверждение_не_начисляет_дважды(): void
    {
        $this->настройки();
        $inviter = $this->человек('Пригласивший');
        $invitee = $this->приглашённый($inviter, '+79990000002');

        $this->подтвердитьТелефон($invitee);
        $this->подтвердитьТелефон($invitee);
        app(ReferralService::class)->onPhoneVerified($invitee->fresh());

        $this->assertSame(100, $this->баллы($inviter), 'начисление обязано быть однократным');
    }

    /**
     * Удалил учётку, завёлся заново тем же телефоном — награды больше нет.
     *
     * Прежние два замка привязаны к учётной записи: `referrals.invitee_id`
     * уникален, статус проверяется под блокировкой. Оба бессильны здесь.
     *
     * Путь настоящий и доступен человеку без всякого администратора:
     * `UserAccountDeletionService` обнуляет телефон и мягко удаляет запись,
     * то есть номер освобождается сразу. Дальше новая регистрация — новый
     * `invitee_id`, новая строка `referrals`, и награда шла бы второй раз.
     * Один телефон кормил бы бесконечно.
     *
     * Третий замок — отметка по хешу телефона в отдельной таблице, которая
     * удаление учётки переживает.
     */
    public function test_та_же_симка_второй_учёткой_награды_не_приносит(): void
    {
        $this->настройки();
        $inviter = $this->человек('Пригласивший');

        $первый = $this->приглашённый($inviter, '+79990000003', 'Первый');
        $this->подтвердитьТелефон($первый);
        $this->assertSame(100, $this->баллы($inviter));

        // Ровно то, что делает кнопка «Удалить аккаунт».
        app(UserAccountDeletionService::class)->delete($первый->fresh());
        $this->assertNull($первый->fresh()->phone, 'подготовка теста: номер обязан освободиться');

        // Тот же телефон, новая учётка.
        $второй = $this->приглашённый($inviter, '+79990000003', 'Второй');
        $this->подтвердитьТелефон($второй);

        $this->assertSame(100, $this->баллы($inviter), 'второй раз за тот же телефон платить нельзя');
        $this->assertSame(
            0,
            (int) Referral::query()->where('invitee_id', $второй->id)->value('points'),
            'приглашение закрыто, но без баллов',
        );
    }

    /** Телефон узнаётся в любой записи: +7…, 8…, с пробелами. */
    public function test_телефон_узнаётся_в_любой_записи(): void
    {
        $this->настройки();
        $inviter = $this->человек('Пригласивший');

        $первый = $this->приглашённый($inviter, '+7 (999) 000-00-04', 'Первый');
        $this->подтвердитьТелефон($первый);
        app(UserAccountDeletionService::class)->delete($первый->fresh());

        $второй = $this->приглашённый($inviter, '89990000004', 'Второй');
        $this->подтвердитьТелефон($второй);

        $this->assertSame(100, $this->баллы($inviter), '8… и +7… — один и тот же номер');
    }

    /**
     * Предел считается в приглашениях, а не в сумме награды.
     *
     * Прежний `max_bonus` сравнивался с суммой начисленного: при награде в
     * 100 баллов предел «10» сработал бы после первого же друга.
     */
    public function test_предел_считает_приглашения_а_не_баллы(): void
    {
        $this->настройки(['points_per_invite' => 100, 'max_paid_invites' => 2]);
        $inviter = $this->человек('Пригласивший');

        foreach ([1, 2, 3] as $i) {
            $друг = $this->приглашённый($inviter, '+7999000010'.$i, "Друг {$i}");
            $this->подтвердитьТелефон($друг);
        }

        $this->assertSame(200, $this->баллы($inviter), 'оплачены два приглашения из трёх');
        $this->assertSame(
            2,
            Referral::query()->where('inviter_id', $inviter->id)->where('points', '>', 0)->count(),
        );
        $this->assertSame(
            3,
            Referral::query()->where('inviter_id', $inviter->id)->count(),
            'третье приглашение засчитано, но не оплачено',
        );
    }

    /** Ноль в пределе — без предела. */
    public function test_ноль_в_пределе_значит_без_предела(): void
    {
        $this->настройки(['points_per_invite' => 50, 'max_paid_invites' => 0]);
        $inviter = $this->человек('Пригласивший');

        foreach ([1, 2, 3, 4] as $i) {
            $друг = $this->приглашённый($inviter, '+7999000020'.$i, "Друг {$i}");
            $this->подтвердитьТелефон($друг);
        }

        $this->assertSame(200, $this->баллы($inviter));
    }

    /** Выключенная акция не начисляет. */
    public function test_выключенная_акция_молчит(): void
    {
        $this->настройки(['enabled' => false]);
        $inviter = $this->человек('Пригласивший');
        $invitee = $this->приглашённый($inviter, '+79990000005');

        $this->подтвердитьТелефон($invitee);

        $this->assertSame(0, $this->баллы($inviter));
    }

    /**
     * Баллы — не деньги: кошелёк не трогается.
     *
     * Прежде за приглашение можно было начислить рубли в кошелёк, откуда
     * есть вывод. Этой ветки больше нет, и проверяется именно она.
     */
    public function test_кошелёк_не_трогается(): void
    {
        $this->настройки(['points_per_invite' => 500]);
        $inviter = $this->человек('Пригласивший');
        $invitee = $this->приглашённый($inviter, '+79990000006');

        $this->подтвердитьТелефон($invitee);

        $this->assertSame(500, $this->баллы($inviter));
        $this->assertSame(
            0,
            (int) (DB::table('wallets')->where('user_id', $inviter->id)->value('balance_kopecks') ?? 0),
            'баллы не должны попадать в кошелёк: оттуда есть вывод',
        );
        $this->assertSame(
            0,
            (int) $inviter->fresh()->listing_placement_credits,
            'и размещения за приглашение больше не выдаются',
        );
    }

    /** Страница приглашений берёт награду и условия из настроек. */
    public function test_страница_показывает_награду_из_настроек(): void
    {
        $this->настройки(['points_per_invite' => 250, 'terms' => 'Условия из админки.']);
        $inviter = $this->человек('Пригласивший');
        $invitee = $this->приглашённый($inviter, '+79990000007');
        $this->подтвердитьТелефон($invitee);

        $this->actingAs($inviter, 'sanctum')
            ->getJson('/api/v1/users/me/referrals')
            ->assertOk()
            ->assertJsonPath('data.points_per_invite', 250)
            ->assertJsonPath('data.terms', 'Условия из админки.')
            ->assertJsonPath('data.bonus', 250)
            ->assertJsonPath('data.points_balance', 250);
    }

    /** Смена числа в настройках меняет то, что видит человек. */
    public function test_смена_награды_меняет_страницу(): void
    {
        $this->настройки(['points_per_invite' => 100]);
        $inviter = $this->человек('Пригласивший');

        $this->actingAs($inviter, 'sanctum')
            ->getJson('/api/v1/users/me/referrals')
            ->assertJsonPath('data.points_per_invite', 100);

        $this->настройки(['points_per_invite' => 300]);

        $this->actingAs($inviter, 'sanctum')
            ->getJson('/api/v1/users/me/referrals')
            ->assertJsonPath('data.points_per_invite', 300);
    }

    /** Правка настроек из админки уходит в журнал изменений. */
    public function test_правка_настроек_пишется_в_журнал(): void
    {
        $owner = $this->человек('Владелец', null, UserRole::Owner);

        $this->actingAs($owner, 'sanctum')
            ->patchJson('/api/v1/admin/settings', ['settings' => [[
                'key' => ReferralProgramConfig::SETTING_KEY,
                'group' => 'marketing',
                'value' => ['enabled' => true, 'points_per_invite' => 777, 'max_paid_invites' => 5, 'terms' => 'Новые условия.'],
            ]]])
            ->assertOk();

        $this->assertSame(777, ReferralProgramConfig::get()['points_per_invite']);
        $this->assertSame('Новые условия.', ReferralProgramConfig::get()['terms']);

        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.settings.update']);
    }

    /**
     * Баланс баллов не уходит в минус.
     *
     * «Должен баллов» не значит ничего: списание сверх остатка отказывает,
     * а не заводит отрицательный счёт.
     */
    public function test_списание_сверх_остатка_отказывает(): void
    {
        $user = $this->человек('Человек');
        $баллы = app(BonusPointsService::class);

        $баллы->credit($user, 100, BonusPointsService::TYPE_ADMIN, 'проба');
        $this->assertNull($баллы->debit($user, 150, BonusPointsService::TYPE_ADMIN, 'много'));
        $this->assertSame(100, $this->баллы($user));

        $this->assertNotNull($баллы->debit($user, 40, BonusPointsService::TYPE_ADMIN, 'в меру'));
        $this->assertSame(60, $this->баллы($user));
    }

    /** Один ключ идемпотентности — одно начисление. */
    public function test_ключ_идемпотентности_не_даёт_начислить_дважды(): void
    {
        $user = $this->человек('Человек');
        $баллы = app(BonusPointsService::class);

        $this->assertNotNull($баллы->credit($user, 30, BonusPointsService::TYPE_ADMIN, 'первое', null, 'k1'));
        $this->assertNull($баллы->credit($user, 30, BonusPointsService::TYPE_ADMIN, 'второе', null, 'k1'));

        $this->assertSame(30, $this->баллы($user));
        $this->assertSame(1, BonusAccount::query()->whereKey($user->id)->count());
    }
}
