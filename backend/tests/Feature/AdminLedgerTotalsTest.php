<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\SafeDeal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Итоги считаются в базе, а не складыванием текущей страницы.
 *
 * Списки кошельков и сделок приходят постранично. Сумма по видимой
 * странице — случайное число, похожее на итог: на второй странице оно
 * другое, и никто этого не замечает.
 */
class AdminLedgerTotalsTest extends TestCase
{
    use RefreshDatabase;

    private function владелец(): User
    {
        return User::factory()->create(['status' => UserStatus::Active, 'role' => UserRole::Owner]);
    }

    private function человекСДвижением(): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $wallets = app(WalletService::class);
        $wallets->credit($user, 500000, WalletTransactionType::Topup, 'пополнение');
        $wallets->debit($user, 100000, WalletTransactionType::SafeDealCommission, 'комиссия');
        $wallets->debit($user, 200000, WalletTransactionType::Withdrawal, 'вывод');

        return $user;
    }

    public function test_it_sums_across_pages_not_just_the_visible_one(): void
    {
        $owner = $this->владелец();
        // Три человека — заведомо больше, чем помещается в одну страницу
        // списка кошельков при мелком `per_page`.
        $this->человекСДвижением();
        $this->человекСДвижением();
        $this->человекСДвижением();

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/admin/ledger/totals')
            ->assertOk()
            ->assertJsonPath('data.received_kopecks', 1500000)
            // Комиссия здесь не проверяется: её источник — сделки, а не
            // проводки, и у неё своя проверка ниже.
            ->assertJsonPath('data.paid_out_kopecks', 600000);
    }

    /**
     * Знаки внутри корзины разные — гасить их нельзя.
     *
     * `safe_deal_payout` в базе положительный (зачисление продавцу),
     * `withdrawal` отрицательный (списание). Первая версия брала модуль у
     * суммы, а не у строки: 4 750 и −1 000 давали 3 750 вместо 5 750, и
     * модуль это прятал. Найдено по боевым данным 25.09.
     */
    public function test_opposite_signs_do_not_cancel_each_other(): void
    {
        $owner = $this->владелец();
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $wallets = app(WalletService::class);

        $wallets->credit($user, 1000000, WalletTransactionType::Topup, 'пополнение');
        // Зачисление продавцу — положительное.
        $wallets->credit($user, 475000, WalletTransactionType::SafeDealPayout, 'по сделке');
        // Вывод — отрицательный.
        $wallets->debit($user, 100000, WalletTransactionType::Withdrawal, 'вывод');

        $итоги = $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/admin/ledger/totals')
            ->assertOk();

        $итоги
            ->assertJsonPath('data.paid_out_kopecks', 100000)
            ->assertJsonPath('data.payouts_to_sellers_kopecks', 475000);
    }

    /** Остаток в кошельках — снимок на сейчас. */
    public function test_it_reports_the_wallet_balance(): void
    {
        $owner = $this->владелец();
        $this->человекСДвижением();

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/admin/ledger/totals')
            ->assertOk()
            ->assertJsonPath('data.wallets_balance_kopecks', 200000);
    }

    /** Период сужает выборку по движениям. */
    public function test_the_period_narrows_the_sum(): void
    {
        $owner = $this->владелец();
        $this->человекСДвижением();

        $завтра = now()->addDay()->toDateString();

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/admin/ledger/totals?from='.$завтра)
            ->assertOk()
            ->assertJsonPath('data.received_kopecks', 0)
            ->assertJsonPath('data.period.from', $завтра);
    }

    /**
     * Комиссия берётся из сделок, а не из проводок.
     *
     * Тип `safe_deal_commission` в перечне есть, но его не пишет никто:
     * в боевой базе на 25.09 ноль таких строк. Первая версия считала по
     * ним — и «Комиссия» показывала бы ноль всегда, что читалось бы как
     * «комиссии нет», а не как «считаем не оттуда».
     *
     * Только завершённые: у отменённой комиссия посчитана, но не удержана.
     */
    public function test_commission_comes_from_completed_deals(): void
    {
        $owner = $this->владелец();
        $buyer = User::factory()->create(['status' => UserStatus::Active]);
        $seller = User::factory()->create(['status' => UserStatus::Active]);

        $сделка = function (string $status, int $fee) use ($buyer, $seller): void {
            SafeDeal::query()->create([
                'uuid' => (string) Str::uuid(),
                'listing_id' => null,
                'buyer_id' => $buyer->id,
                'seller_id' => $seller->id,
                'amount_kopecks' => 100000,
                'platform_fee_kopecks' => $fee,
                'seller_payout_kopecks' => 100000 - $fee,
                'currency' => 'RUB',
                'status' => $status,
            ]);
        };

        $сделка('completed', 5000);
        $сделка('completed', 3000);
        $сделка('cancelled', 90000);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/admin/ledger/totals')
            ->assertOk()
            ->assertJsonPath('data.commission_kopecks', 8000);
    }

    /** Ручка владельческая: модератору деньги площадки не показываем. */
    public function test_a_moderator_cannot_read_the_totals(): void
    {
        $moderator = User::factory()->create([
            'status' => UserStatus::Active,
            'role' => UserRole::Moderator,
        ]);

        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/ledger/totals')
            ->assertForbidden();
    }
}
