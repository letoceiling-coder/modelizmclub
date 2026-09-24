<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Обнуление кошельков приёмки: добавляет списание, а не стирает историю.
 */
class ZeroWalletsCommandTest extends TestCase
{
    use RefreshDatabase;

    private function человекСДеньгами(int $копеек): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        if ($копеек > 0) {
            app(WalletService::class)->credit($user, $копеек, WalletTransactionType::Topup, 'начальные');
        }

        return $user;
    }

    public function test_dry_run_changes_nothing(): void
    {
        $user = $this->человекСДеньгами(838000);

        $this->artisan('wallets:zero', ['users' => [$user->id], '--dry-run' => true])
            ->expectsOutputToContain('Сухой прогон')
            ->assertSuccessful();

        $this->assertSame(838000, app(WalletService::class)->balanceKopecks($user->fresh()));
    }

    /**
     * Главное: проводки остаются. Обнуление — новая строка поверх истории,
     * а не её стирание; иначе баланс перестанет сводиться с движением.
     */
    public function test_zeroing_adds_a_row_and_keeps_the_old_ones(): void
    {
        $user = $this->человекСДеньгами(838000);
        $былоСтрок = $user->wallet()->first()->transactions()->count();

        $this->artisan('wallets:zero', [
            'users' => [$user->id],
            '--reason' => 'Обнуление учётной записи приёмки перед запуском',
        ])->assertSuccessful();

        $wallet = $user->fresh()->wallet()->first();
        $this->assertSame(0, (int) $wallet->balance_kopecks);
        $this->assertSame($былоСтрок + 1, $wallet->transactions()->count(), 'старые проводки должны остаться');

        $this->assertDatabaseHas('wallet_transactions', [
            'wallet_id' => $wallet->id,
            'type' => WalletTransactionType::AdminAdjustment->value,
            'amount_kopecks' => -838000,
        ]);
    }

    /** Списание попадает в аудит: иначе деньги исчезают без следа. */
    public function test_zeroing_is_written_to_the_audit(): void
    {
        $actor = User::factory()->create(['status' => UserStatus::Active]);
        $user = $this->человекСДеньгами(500000);

        $this->artisan('wallets:zero', ['users' => [$user->id], '--actor' => $actor->id])
            ->assertSuccessful();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $actor->id,
            'action' => 'admin.wallets.zeroed',
            'auditable_id' => $user->id,
        ]);
    }

    /**
     * Залог принадлежит незакрытой сделке, а не кошельку.
     *
     * Списать его отсюда значило бы оставить сделку без обеспечения:
     * покупатель заплатил, деньги ушли, продавцу платить нечем.
     */
    public function test_a_held_balance_stops_the_command(): void
    {
        $user = $this->человекСДеньгами(838000);
        app(WalletService::class)->hold($user, 100000);

        $this->artisan('wallets:zero', ['users' => [$user->id]])
            ->expectsOutputToContain('в залоге')
            ->assertFailed();

        $this->assertGreaterThan(0, app(WalletService::class)->balanceKopecks($user->fresh()));
    }

    /** Пустой кошелёк пропускается, а не роняет прогон. */
    public function test_an_empty_wallet_is_skipped(): void
    {
        $user = $this->человекСДеньгами(0);

        $this->artisan('wallets:zero', ['users' => [$user->id]])
            ->expectsOutputToContain('пропускаю')
            ->assertSuccessful();
    }
}
