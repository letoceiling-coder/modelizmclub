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
 * Выгрузка реестра сделок показывает факт, а не только план.
 *
 * ЧТО БЫЛО НЕ ТАК. Столбцы «К выплате продавцу» и «Комиссия» берутся из
 * колонок сделки, а это план: сколько предполагалось выплатить и удержать.
 * При разрешении спора делением `splitPayout` их не трогает — фактические
 * доли пишутся в `metadata.split`.
 *
 * На проде сделка #28 показывала «К выплате продавцу 950 ₽», а выплачено
 * было 400 ₽. Построчно это не обман: в столбце стоит поле сделки. Но
 * бухгалтерия суммирует столбцы, и сумма получалась неверной — ровно то
 * искажение, которое 29.09 чинили в сводке.
 *
 * Плановые столбцы остались: по ним сходится арифметика строки. Факт
 * добавлен рядом и назван фактом.
 */
class DealExportShowsFactTest extends TestCase
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

    /** @return array<int, array<int, string>> строки выгрузки, первая — заголовки */
    private function выгрузка(User $admin): array
    {
        $ответ = $this->actingAs($admin, 'sanctum')->get('/api/v1/admin/safe-deals/export');
        $ответ->assertOk();

        $csv = ltrim($ответ->streamedContent(), "\xEF\xBB\xBF");

        return array_map(
            static fn (string $строка) => str_getcsv($строка, ';'),
            array_filter(explode("\n", trim($csv)), static fn ($s) => trim($s) !== ''),
        );
    }

    /** @param array<int, string> $заголовки */
    private function столбец(array $заголовки, string $имя): int
    {
        $i = array_search($имя, $заголовки, true);
        $this->assertNotFalse($i, "в выгрузке нет столбца «{$имя}»");

        return (int) $i;
    }

    public function test_обычная_сделка_план_и_факт_совпадают(): void
    {
        // Контроль. Без него «у разделённой ноль» означало бы не отбор, а
        // столбец, в котором всегда ноль.
        $this->сделка();
        $строки = $this->выгрузка($this->owner());
        $ш = $строки[0];

        $this->assertSame('завершена', $строки[1][$this->столбец($ш, 'Исход')]);
        $this->assertSame('1000,00', $строки[1][$this->столбец($ш, 'Фактически продавцу (₽)')]);
        $this->assertSame('50,00', $строки[1][$this->столбец($ш, 'Фактически удержано площадкой (₽)')]);
        $this->assertSame('0,00', $строки[1][$this->столбец($ш, 'Фактически возвращено покупателю (₽)')]);
    }

    public function test_разделённая_в_споре_показывает_фактические_доли(): void
    {
        /*
         * Покупателю 600 плюс возвращённая комиссия 50, продавцу 400.
         * План при этом остался прежним: «к выплате продавцу» — 1000 ₽.
         */
        $this->сделка([
            'metadata' => ['split' => [
                'buyer_kopecks' => 65000,
                'seller_kopecks' => 40000,
                'fee_returned_kopecks' => 5000,
            ]],
        ]);

        $строки = $this->выгрузка($this->owner());
        $ш = $строки[0];
        $строка = $строки[1];

        $this->assertSame('разделена в споре', $строка[$this->столбец($ш, 'Исход')]);
        $this->assertSame('400,00', $строка[$this->столбец($ш, 'Фактически продавцу (₽)')]);
        $this->assertSame('650,00', $строка[$this->столбец($ш, 'Фактически возвращено покупателю (₽)')]);
        $this->assertSame('0,00', $строка[$this->столбец($ш, 'Фактически удержано площадкой (₽)')]);

        // План остаётся на месте: по нему сходится арифметика строки.
        $this->assertSame('1000,00', $строка[$this->столбец($ш, 'К выплате продавцу (₽)')]);
    }

    public function test_отменённая_сделка_возвращает_всё_покупателю(): void
    {
        $this->сделка(['status' => SafeDealStatus::Cancelled]);

        $строки = $this->выгрузка($this->owner());
        $ш = $строки[0];

        $this->assertSame('возврат покупателю', $строки[1][$this->столбец($ш, 'Исход')]);
        $this->assertSame('1050,00', $строки[1][$this->столбец($ш, 'Фактически возвращено покупателю (₽)')]);
        $this->assertSame('0,00', $строки[1][$this->столбец($ш, 'Фактически продавцу (₽)')]);
        $this->assertSame('0,00', $строки[1][$this->столбец($ш, 'Фактически удержано площадкой (₽)')]);
    }

    public function test_незавершённая_сделка_фактов_ещё_не_имеет(): void
    {
        $this->сделка(['status' => SafeDealStatus::Paid]);

        $строки = $this->выгрузка($this->owner());
        $ш = $строки[0];

        $this->assertSame('не завершена', $строки[1][$this->столбец($ш, 'Исход')]);
        $this->assertSame('0,00', $строки[1][$this->столбец($ш, 'Фактически продавцу (₽)')]);
    }

    public function test_сводка_и_выгрузка_отвечают_одинаково(): void
    {
        /*
         * Один вопрос — «сколько площадка удержала» — задают два места, и
         * отвечают они по-разному устроенным кодом: сводка считает SQL
         * (`not jsonb_exists(metadata, 'split')`), выгрузка — классом
         * `SafeDealOutcome`. Пока их не сверяет ничто, они согласованы «по
         * коду», то есть до первой правки одного из них.
         *
         * Ради этого здесь набор из всех четырёх исходов: если правило
         * разойдётся хоть на одном, числа перестанут совпадать.
         */
        $this->сделка();
        $this->сделка([
            'metadata' => ['split' => ['buyer_kopecks' => 65000, 'seller_kopecks' => 40000, 'fee_returned_kopecks' => 5000]],
        ]);
        $this->сделка(['status' => SafeDealStatus::Cancelled]);
        $this->сделка(['status' => SafeDealStatus::Paid]);

        $admin = $this->owner();

        $строки = $this->выгрузка($admin);
        $ш = $строки[0];
        $i = $this->столбец($ш, 'Фактически удержано площадкой (₽)');
        $число = static fn (string $v): float => (float) str_replace(',', '.', $v);
        $поВыгрузке = array_sum(array_map(fn ($r) => $число($r[$i]), array_slice($строки, 1)));

        $поСводке = (int) $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/ledger/totals')
            ->assertOk()
            ->json('data.commission_kopecks');

        // Приведение явное: точное деление int на int в PHP даёт int, и
        // assertSame сравнивает типы — 50 и 50.0 разошлись бы на ровном месте.
        $this->assertSame(
            (float) ($поСводке / 100),
            $поВыгрузке,
            'сводка и выгрузка разошлись в том, сколько площадка удержала',
        );
        // И контроль, что сравнение не «ноль равен нулю».
        $this->assertSame(50.0, $поВыгрузке);
    }

    public function test_сумма_столбца_факта_равна_тому_что_ушло(): void
    {
        /*
         * Главное ради чего всё: бухгалтерия суммирует столбец. Одна
         * обычная сделка и одна разделённая — сумма факта должна быть
         * 1000 + 400, а не 1000 + 1000.
         */
        $this->сделка();
        $this->сделка([
            'metadata' => ['split' => ['buyer_kopecks' => 65000, 'seller_kopecks' => 40000, 'fee_returned_kopecks' => 5000]],
        ]);

        $строки = $this->выгрузка($this->owner());
        $ш = $строки[0];
        $i = $this->столбец($ш, 'Фактически продавцу (₽)');
        $план = $this->столбец($ш, 'К выплате продавцу (₽)');

        // Разделитель в выгрузке — запятая: так его читает русский Excel.
        $число = static fn (string $v): float => (float) str_replace(',', '.', $v);
        $факт = array_sum(array_map(fn ($r) => $число($r[$i]), array_slice($строки, 1)));
        $поПлану = array_sum(array_map(fn ($r) => $число($r[$план]), array_slice($строки, 1)));

        $this->assertSame(1400.0, $факт);
        $this->assertSame(2000.0, $поПлану, 'плановый столбец и есть источник прежнего расхождения');
    }
}
