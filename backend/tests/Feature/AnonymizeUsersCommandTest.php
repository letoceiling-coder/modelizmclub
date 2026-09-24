<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Обезличивание вместо удаления: учётка перестаёт работать, бухгалтерия
 * остаётся.
 */
class AnonymizeUsersCommandTest extends TestCase
{
    use RefreshDatabase;

    private function учётка(): User
    {
        return User::factory()->create([
            'status' => UserStatus::Active,
            'role' => UserRole::User,
        ]);
    }

    public function test_dry_run_changes_nothing(): void
    {
        $user = $this->учётка();
        $почта = $user->email;

        $this->artisan('users:anonymize', ['users' => [$user->id], '--dry-run' => true])
            ->expectsOutputToContain('Сухой прогон')
            ->assertSuccessful();

        $this->assertSame($почта, $user->fresh()->email);
        $this->assertSame(UserStatus::Active, $user->fresh()->status);
    }

    public function test_it_blocks_and_wipes_personal_fields(): void
    {
        $user = $this->учётка();
        $user->forceFill(['phone' => '+79990000000', 'phone_verified_at' => now()])->save();

        $this->artisan('users:anonymize', ['users' => [$user->id]])->assertSuccessful();

        $свежий = $user->fresh();
        $this->assertSame(UserStatus::Blocked, $свежий->status);
        $this->assertSame('anonymized-'.$user->id.'@removed.invalid', $свежий->email);
        $this->assertSame('Удалённая учётная запись', $свежий->name);
        $this->assertNull($свежий->phone);
        $this->assertNull($свежий->phone_verified_at);
    }

    /** Токены отзываются: иначе учётка «заблокирована», а ходить по API можно. */
    public function test_it_revokes_every_token(): void
    {
        $user = $this->учётка();
        $user->createToken('проба');
        $user->createToken('ещё одна');
        $this->assertSame(2, $user->tokens()->count());

        $this->artisan('users:anonymize', ['users' => [$user->id]])->assertSuccessful();

        $this->assertSame(0, $user->fresh()->tokens()->count());
    }

    /**
     * Главное, ради чего это вместо удаления: проводки остаются.
     *
     * У wallets и wallet_transactions внешний ключ на users объявлен
     * CASCADE — удаление учётки снесло бы всю её бухгалтерию.
     */
    public function test_the_ledger_survives(): void
    {
        $user = $this->учётка();
        app(WalletService::class)->credit($user, 500000, WalletTransactionType::Topup, 'проба');
        $кошелёк = $user->wallet()->first();
        $строк = $кошелёк->transactions()->count();
        $this->assertGreaterThan(0, $строк);

        $this->artisan('users:anonymize', ['users' => [$user->id]])->assertSuccessful();

        $this->assertDatabaseHas('wallets', ['id' => $кошелёк->id, 'user_id' => $user->id]);
        $this->assertSame($строк, $кошелёк->fresh()->transactions()->count(), 'проводки должны остаться');
    }

    /**
     * Публичное имя живёт в профиле, а не в `users`.
     *
     * Рядом с объявлениями и сделками показывается
     * `user_profiles.display_name` — в бэкенде 31 место читает именно его.
     * Первая версия команды трогала только `users`, и обезличенная учётка
     * продолжала бы показывать своё имя под каждой оставшейся сделкой.
     */
    public function test_it_wipes_the_public_profile(): void
    {
        $user = $this->учётка();
        UserProfile::query()->updateOrCreate(['user_id' => $user->id], [
            'display_name' => 'ТЕСТ С СМС',
            'slug' => 'test-s-sms',
            'bio' => 'био',
            'vk_url' => 'https://vk.com/test',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        $this->artisan('users:anonymize', ['users' => [$user->id]])->assertSuccessful();

        $профиль = UserProfile::query()->where('user_id', $user->id)->first();
        $this->assertSame('Удалённая учётная запись', $профиль->display_name);
        $this->assertSame('removed-'.$user->id, $профиль->slug);
        $this->assertNull($профиль->bio);
        $this->assertNull($профиль->vk_url);
    }

    /** Привязки соцсетей уходят вместе с их токенами. */
    public function test_it_removes_oauth_links(): void
    {
        $user = $this->учётка();
        DB::table('user_oauth_accounts')->insert([
            'user_id' => $user->id,
            'provider' => 'vk',
            'provider_user_id' => '123456',
            'token' => json_encode(['access_token' => 'секрет']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('users:anonymize', ['users' => [$user->id]])->assertSuccessful();

        $this->assertSame(0, DB::table('user_oauth_accounts')->where('user_id', $user->id)->count());
    }

    /**
     * Отказ на втором id не оставляет первый обезличенным.
     *
     * До 25.09 каждый id правился в своей транзакции, и прогон
     * `users:anonymize 1228 1229 1230` при неверной роли третьего оставлял
     * первые два необратимо изменёнными — возвращая при этом FAILURE.
     */
    public function test_a_failure_on_a_later_id_leaves_the_earlier_ones_alone(): void
    {
        $первый = $this->учётка();
        $почта = $первый->email;
        $сотрудник = $this->учётка();
        $сотрудник->forceFill(['role' => UserRole::Moderator])->save();

        $this->artisan('users:anonymize', ['users' => [$первый->id, $сотрудник->id]])
            ->expectsOutputToContain('не трогаю никого')
            ->assertFailed();

        $this->assertSame($почта, $первый->fresh()->email, 'первый не должен пострадать');
        $this->assertSame(UserStatus::Active, $первый->fresh()->status);
    }

    public function test_it_is_written_to_the_audit(): void
    {
        $actor = $this->учётка();
        $user = $this->учётка();

        $this->artisan('users:anonymize', ['users' => [$user->id], '--actor' => $actor->id])
            ->assertSuccessful();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $actor->id,
            'action' => 'admin.users.anonymized',
            'auditable_id' => $user->id,
        ]);
    }

    /**
     * Сотрудника обезличивать нельзя молча.
     *
     * «Заблокированный владелец» — состояние, которого никто не ждёт:
     * права остались, войти нельзя, и почему — непонятно.
     */
    public function test_a_staff_account_stops_the_command(): void
    {
        $user = $this->учётка();
        $user->forceFill(['role' => UserRole::Moderator])->save();

        $this->artisan('users:anonymize', ['users' => [$user->id]])
            ->expectsOutputToContain('сначала снимите роль')
            ->assertFailed();

        $this->assertSame(UserStatus::Active, $user->fresh()->status);
    }
}
