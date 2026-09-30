<?php

namespace Tests\Feature;

use App\Enums\DisputeStatus;
use App\Enums\SafeDealFeePayer;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Dispute;
use App\Models\SafeDeal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Billing\Services\SafeDealService;
use Tests\TestCase;

/**
 * Разрешение спора пишет факт в колонки сделки.
 *
 * ЧТО БЫЛО. `splitPayout` раздавал удержание и писал доли только в
 * `metadata.split`, а `seller_payout_kopecks` и `platform_fee_kopecks`
 * оставались теми, что поставили при создании. То есть по строке нельзя
 * было узнать, сколько на самом деле ушло.
 *
 * Читателей оказалось пять, и каждый узнавал факт сам, отдельной
 * правкой: письмо о шаге сделки, сводка бухгалтерии, выгрузка реестра,
 * страница сделки — продавцу показывали «Выплата 950 ₽» там, где он
 * получил 400, — и служба выплат, которая берёт сумму перевода из этой
 * самой колонки.
 *
 * ПОЧЕМУ ЭТА ПРОВЕРКА ИДЁТ ЧЕРЕЗ НАСТОЯЩЕЕ РАЗРЕШЕНИЕ СПОРА. Остальные
 * проверки собирают строку руками и потому доказывают только то, что
 * читатели согласованы между собой. Что колонки заполняет сам код, может
 * показать лишь вызов `resolveDispute`.
 */
class DisputeSplitWritesFactTest extends TestCase
{
    use RefreshDatabase;

    private function человек(UserRole $role = UserRole::User): User
    {
        return User::factory()->create([
            'role' => $role,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    /** @return array{0: SafeDeal, 1: Dispute, 2: User} покупатель платит комиссию */
    private function спорПоОплаченнойСделке(): array
    {
        $buyer = $this->человек();
        $seller = $this->человек();

        // Холд: товар 1000 + комиссия 50. План выплаты — вся цена товара,
        // потому что комиссию платит покупатель.
        $deal = SafeDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'status' => SafeDealStatus::Disputed,
            'item_kopecks' => 100000,
            'platform_fee_kopecks' => 5000,
            'delivery_cost_kopecks' => 0,
            'amount_kopecks' => 105000,
            'seller_payout_kopecks' => 100000,
            'fee_payer' => SafeDealFeePayer::Buyer,
            'paid_at' => now(),
        ]);

        // Деньги в удержании: без него раздача упадёт.
        DB::table('wallets')->updateOrInsert(
            ['user_id' => $buyer->id],
            ['balance_kopecks' => 0, 'held_kopecks' => 105000, 'created_at' => now(), 'updated_at' => now()],
        );

        $dispute = Dispute::query()->create([
            'uuid' => (string) Str::uuid(),
            'safe_deal_id' => $deal->id,
            'opened_by' => $buyer->id,
            'reason' => 'Товар не соответствует описанию',
            'status' => DisputeStatus::Open,
        ]);

        return [$deal, $dispute, $this->человек(UserRole::Owner)];
    }

    public function test_разделение_пишет_факт_в_колонки(): void
    {
        [$deal, $dispute, $admin] = $this->спорПоОплаченнойСделке();

        // Делится товар: 600 покупателю, 400 продавцу. Комиссия
        // возвращается покупателю сверх его доли и в делёж не входит.
        app(SafeDealService::class)->resolveDispute($admin, $dispute, 'split', 'Спор: сумма разделена.', 60000, 40000);

        $deal->refresh();

        $this->assertSame(SafeDealStatus::Completed, $deal->status);
        $this->assertSame(40000, (int) $deal->seller_payout_kopecks, 'в колонке остался план вместо факта');
        $this->assertSame(0, (int) $deal->platform_fee_kopecks, 'площадка по разделённой сделке ничего не удержала');

        // Разбивка на месте: доля покупателя включает возвращённую комиссию.
        $this->assertSame(65000, (int) ($deal->metadata['split']['buyer_kopecks'] ?? 0));
        $this->assertSame(5000, (int) ($deal->metadata['split']['fee_returned_kopecks'] ?? 0));
    }

    public function test_после_разделения_сводка_считает_ноль(): void
    {
        /*
         * Главное следствие. Прежде сводка вычитала разделённые сделки
         * отдельным условием по `metadata`; теперь достаточно колонки, и
         * второго правила в коде нет.
         */
        [, $dispute, $admin] = $this->спорПоОплаченнойСделке();

        app(SafeDealService::class)->resolveDispute($admin, $dispute, 'split', 'Спор: сумма разделена.', 60000, 40000);

        $this->assertSame(
            0,
            (int) $this->actingAs($admin, 'sanctum')
                ->getJson('/api/v1/admin/ledger/totals')
                ->assertOk()
                ->json('data.commission_kopecks'),
        );
    }

    public function test_разрешение_в_пользу_покупателя_обнуляет_обе_колонки(): void
    {
        [$deal, $dispute, $admin] = $this->спорПоОплаченнойСделке();

        app(SafeDealService::class)->resolveDispute($admin, $dispute, 'buyer', 'Спор: в пользу покупателя.');

        $deal->refresh();
        $this->assertSame(0, (int) $deal->seller_payout_kopecks);
        $this->assertSame(0, (int) $deal->platform_fee_kopecks, 'по возвращённой сделке комиссия не удерживается');
    }

    public function test_разрешение_в_пользу_продавца_колонки_не_меняет(): void
    {
        /*
         * Контроль. Без него «колонки обнуляются» могло бы означать
         * «обнуляются всегда»: при выплате продавцу целиком площадка
         * комиссию как раз удерживает, и обнулить её здесь значило бы
         * потерять доход в сводке.
         */
        [$deal, $dispute, $admin] = $this->спорПоОплаченнойСделке();

        app(SafeDealService::class)->resolveDispute($admin, $dispute, 'seller', 'Спор: в пользу продавца.');

        $deal->refresh();
        $this->assertSame(SafeDealStatus::Completed, $deal->status);
        $this->assertSame(100000, (int) $deal->seller_payout_kopecks);
        $this->assertSame(5000, (int) $deal->platform_fee_kopecks);
    }
}
