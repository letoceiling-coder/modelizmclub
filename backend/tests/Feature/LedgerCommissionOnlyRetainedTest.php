<?php

namespace Tests\Feature;

use App\Enums\SafeDealFeePayer;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\SafeDeal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Бухгалтерия считает комиссией только то, что площадка оставила себе.
 *
 * ЧТО БЫЛО НЕ ТАК. «Комиссия» в сводке — это `sum(platform_fee_kopecks)`
 * по завершённым сделкам. У сделки, разрешённой спором с разделением
 * суммы, статус тоже `completed`, но площадка по ней не получает ничего:
 * `SafeDealService::splitPayout` раздаёт удержание целиком — доля
 * покупателя плюс возвращённая комиссия, доля продавца, и в сумме это
 * весь холд.
 *
 * На боевых данных 29.09: сводка показывала 205,55 ₽, площадка получила
 * 155,55 ₽. Разница — сделка #28, разделённая в споре.
 *
 * Отменённые сделки из подсчёта исключены давно и по той же причине; у
 * разделённых она та же, просто статус другой.
 */
class LedgerCommissionOnlyRetainedTest extends TestCase
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

    /** @param array<string, mixed> $поля */
    private function сделка(array $поля = []): SafeDeal
    {
        return SafeDeal::query()->create(array_merge([
            'uuid' => (string) Str::uuid(),
            'buyer_id' => User::factory()->create()->id,
            'seller_id' => User::factory()->create()->id,
            'status' => SafeDealStatus::Completed,
            'item_kopecks' => 100000,
            'platform_fee_kopecks' => 5000,
            'delivery_cost_kopecks' => 0,
            'amount_kopecks' => 105000,
            'seller_payout_kopecks' => 100000,
            'fee_payer' => SafeDealFeePayer::Buyer,
        ], $поля));
    }

    private function комиссия(User $admin): int
    {
        return (int) $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/ledger/totals')
            ->assertOk()
            ->json('data.commission_kopecks');
    }

    public function test_a_plain_completed_deal_counts_as_commission(): void
    {
        // Контроль: без него «ноль у разделённой» означал бы сломанный
        // запрос, а не отбор.
        $this->сделка();

        $this->assertSame(5000, $this->комиссия($this->owner()));
    }

    public function test_a_split_deal_brings_no_commission(): void
    {
        /*
         * Разделение раздаёт удержание целиком: покупателю его доля плюс
         * возвращённая комиссия, продавцу — его. Площадке не остаётся
         * ничего, и записывать это в доход нельзя.
         */
        $this->сделка([
            'metadata' => ['split' => ['buyer_kopecks' => 60000, 'seller_kopecks' => 45000]],
        ]);

        $this->assertSame(0, $this->комиссия($this->owner()));
    }

    public function test_a_split_deal_does_not_inflate_the_others(): void
    {
        $this->сделка();
        $this->сделка([
            'metadata' => ['split' => ['buyer_kopecks' => 60000, 'seller_kopecks' => 45000]],
        ]);

        // Ровно одна обычная сделка — ровно её комиссия.
        $this->assertSame(5000, $this->комиссия($this->owner()));
    }

    public function test_a_cancelled_deal_still_brings_no_commission(): void
    {
        // Так было и раньше; проверка закрепляет, чтобы правка отбора это
        // не отменила.
        $this->сделка(['status' => SafeDealStatus::Cancelled]);

        $this->assertSame(0, $this->комиссия($this->owner()));
    }

    public function test_metadata_without_a_split_is_not_mistaken_for_one(): void
    {
        /*
         * Отбор идёт по наличию ключа, и в `metadata` лежит много чего
         * ещё — надбавка доставки, пункт выдачи. Строка со своей
         * метаданной, но без разделения, обязана считаться обычной.
         */
        $this->сделка(['metadata' => ['delivery_markup_kopecks' => 4000, 'cdek' => ['point' => 'X']]]);

        $this->assertSame(5000, $this->комиссия($this->owner()));
    }
}
