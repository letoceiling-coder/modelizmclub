<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Services\BonusPointsService;
use Tests\TestCase;

/**
 * Карточка пользователя показывает бонусные баллы и не путает их со
 * штуками размещений.
 *
 * ПОЧЕМУ ЭТО ПОНАДОБИЛОСЬ. Карточку делали 27.09, когда баллов в системе
 * не было: `bonus_accounts.balance` никто не увеличивал. 28.09 баллы
 * появились по-настоящему — и карточка осталась с прежним представлением,
 * а её докблок с тех пор утверждает неправду.
 *
 * Хуже другого: журнал `bonus_transactions` общий. Выдача размещений
 * пишет туда `admin_grant`, старая награда за друга — `referral` (штуки),
 * новая — `referral_points` (баллы). Карточка читала журнал без фильтра
 * по типу, и начисление ста баллов показывалось в разделе «Размещение
 * объявлений» как сто размещений.
 */
class AdminUserCardBonusPointsTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    private function карточка(User $admin, User $кого): array
    {
        return $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/admin/users/{$кого->uuid}/card")
            ->assertOk()
            ->json('data');
    }

    public function test_the_card_shows_the_real_points_balance(): void
    {
        $человек = User::factory()->create();
        app(BonusPointsService::class)->credit(
            $человек,
            100,
            BonusPointsService::TYPE_REFERRAL,
            'Баллы за приглашённого друга',
        );

        $card = $this->карточка($this->owner(), $человек);

        $this->assertArrayHasKey('bonus', $card, 'В карточке нет блока о баллах.');
        $this->assertSame(100, $card['bonus']['balance']);
        $this->assertSame(100, $card['bonus']['earned_by_referrals']);
    }

    public function test_zero_points_are_shown_as_zero_and_not_hidden(): void
    {
        /*
         * Раньше блок не показывали вовсе — с доводом «бонусов нет в
         * системе». Теперь они есть, и ноль означает именно ноль: это
         * ответ на вопрос «сколько у человека баллов», а не отсутствие
         * ответа.
         */
        $card = $this->карточка($this->owner(), User::factory()->create());

        $this->assertSame(0, $card['bonus']['balance']);
        $this->assertSame(0, $card['bonus']['earned_by_referrals']);
    }

    public function test_points_do_not_leak_into_the_placements_list(): void
    {
        $человек = User::factory()->create();

        // Сто баллов за друга.
        app(BonusPointsService::class)->credit(
            $человек,
            100,
            BonusPointsService::TYPE_REFERRAL,
            'Баллы за приглашённого друга',
        );

        // И одно размещение, выданное из админки.
        DB::table('bonus_transactions')->insert([
            'account_user_id' => $человек->id,
            'amount' => 1,
            'type' => 'admin_grant',
            'description' => 'Выдано администратором',
            'created_at' => now(),

        ]);

        $card = $this->карточка($this->owner(), $человек);
        $типы = array_column($card['placement_grants'], 'type');

        // Контроль: выдача размещений в списке есть — значит список
        // вообще наполняется, и пустота по баллам означает отбор, а не
        // сломанный запрос.
        $this->assertContains('admin_grant', $типы);
        $this->assertNotContains(
            BonusPointsService::TYPE_REFERRAL,
            $типы,
            'Начисление баллов попало в список размещений.',
        );
    }

    public function test_an_old_referral_row_still_counts_as_a_placement(): void
    {
        /*
         * До 28.09 награда за друга была одним размещением и писалась
         * типом `referral`. Эти строки остаются размещениями: пересчёт
         * их в баллы был бы выдумкой задним числом.
         */
        $человек = User::factory()->create();
        // Внешний ключ журнала смотрит на счёт, а не на пользователя.
        DB::table('bonus_accounts')->insertOrIgnore(['user_id' => $человек->id, 'balance' => 0]);
        DB::table('bonus_transactions')->insert([
            'account_user_id' => $человек->id,
            'amount' => 1,
            'type' => 'referral',
            'description' => 'Бонус за приглашение друга',
            'created_at' => now()->subMonth(),

        ]);

        $card = $this->карточка($this->owner(), $человек);

        $this->assertContains('referral', array_column($card['placement_grants'], 'type'));
        // И в баллы она не попадает.
        $this->assertSame(0, $card['bonus']['balance']);
        $this->assertSame(0, $card['bonus']['earned_by_referrals']);
    }

    public function test_the_points_block_is_owner_only_like_the_wallet(): void
    {
        /*
         * Баллы — про деньги человека в той же мере, что кошелёк, и
         * показываются по тому же правилу. Не «спрятано», а «модератору
         * этого знать не нужно»: отсутствие ключа, а не ноль, иначе
         * модератор прочитал бы «у человека нет баллов».
         */
        $moderator = User::factory()->create([
            'role' => UserRole::Moderator,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);

        $человек = User::factory()->create();
        app(BonusPointsService::class)->credit($человек, 50, BonusPointsService::TYPE_REFERRAL, 'Баллы');

        $card = $this->карточка($moderator, $человек);

        $this->assertArrayNotHasKey('bonus', $card);
        $this->assertArrayNotHasKey('wallet', $card);
    }
}
