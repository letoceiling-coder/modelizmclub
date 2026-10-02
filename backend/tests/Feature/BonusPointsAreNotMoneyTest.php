<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\BonusTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Services\BonusPointsService;
use Tests\TestCase;

/**
 * Баллы не превращаются в деньги.
 *
 * Это сказано в задании и нигде не закреплено: механизма перевода нет,
 * и до сих пор правило держалось на его отсутствии. Отсутствие — не
 * гарантия: достаточно одной правки, которая «удобно» зачтёт баллы в
 * кошелёк, и обещание «вывести нельзя» перестанет быть правдой молча.
 *
 * Поэтому правило проверяется поведением: человек с полным счётом
 * баллов и пустым кошельком вывести не может, и после попытки у него
 * по-прежнему ноль рублей и те же баллы.
 */
class BonusPointsAreNotMoneyTest extends TestCase
{
    use RefreshDatabase;

    private function человекСБаллами(int $баллов): User
    {
        $кто = User::factory()->create([
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);

        app(BonusPointsService::class)->credit(
            $кто,
            $баллов,
            BonusPointsService::TYPE_REFERRAL,
            'Приглашённый друг',
            null,
            'friend-'.$кто->id,
        );

        return $кто;
    }

    public function test_баллы_не_попадают_в_кошелёк(): void
    {
        $кто = $this->человекСБаллами(1000);

        $this->assertSame(1000, app(BonusPointsService::class)->balance($кто), 'подготовка: баллы не начислились');

        $кошелёк = $this->actingAs($кто, 'sanctum')->getJson('/api/v1/wallet');
        $кошелёк->assertOk();

        /*
         * Ключ читается точно, без `??`: тело ответа плоское
         * (`{"balance":0,"balance_kopecks":0,…}`), а первая версия этой
         * проверки читала `data.balance_kopecks`, получала null и
         * сравнивала с нулём — то есть проходила при любом балансе.
         * Проверено опытом: кошелёк с тысячей рублей её не ронял.
         */
        $рубли = $кошелёк->json('balance_kopecks');
        $this->assertNotNull($рубли, 'баланс не найден — проверка смотрит не туда');
        $this->assertSame(0, (int) $рубли, 'баллы зачлись в рублёвый баланс');
    }

    public function test_вывести_баллы_нельзя(): void
    {
        $кто = $this->человекСБаллами(1000);

        $ответ = $this->actingAs($кто, 'sanctum')->postJson('/api/v1/wallet/withdraw', [
            'amount_kopecks' => 100000,
        ]);

        $this->assertNotSame(200, $ответ->status(), 'вывод баллов прошёл');

        $this->assertSame(1000, app(BonusPointsService::class)->balance($кто), 'баллы списались на вывод');
        $this->assertSame(
            0,
            BonusTransaction::query()->where('account_user_id', $кто->id)->where('amount', '<', 0)->count(),
            'появилась расходная проводка по баллам, которой никто не просил',
        );
    }
}
