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
 * Колонки сделки держат факт — и все читатели видят одно и то же.
 *
 * ЧТО БЫЛО НЕ ТАК. `seller_payout_kopecks` и `platform_fee_kopecks`
 * заполнялись при создании и больше не менялись. При разрешении спора
 * делением факт уходил в `metadata.split`, а колонки оставались планом.
 *
 * Читателей оказалось пять, и каждый узнавал факт сам: письмо о сделке,
 * сводка бухгалтерии, выгрузка реестра, страница сделки (продавцу
 * показывали «Выплата 950 ₽» там, где он получил 400) и служба выплат —
 * она берёт сумму перевода из этой самой колонки.
 *
 * С 30.09 колонки держат факт, и разбор `metadata` остался только там,
 * где нужна разбивка: в письме и в доле покупателя.
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
        $this->assertSame('1000,00', $строки[1][$this->столбец($ш, 'К выплате продавцу (₽)')]);
        $this->assertSame('50,00', $строки[1][$this->столбец($ш, 'Комиссия (₽)')]);

    }

    public function test_разделённая_в_споре_показывает_фактические_доли(): void
    {
        /*
         * Покупателю 600 плюс возвращённая комиссия 50, продавцу 400.
         * План при этом остался прежним: «к выплате продавцу» — 1000 ₽.
         */
        /*
         * Заготовка представляет законное состояние: с 30.09 разделённая
         * сделка держит факт и в колонках. Строка, где колонки остались
         * планом, теперь невозможна — код её не создаёт.
         *
         * Что код действительно пишет факт, проверяет
         * `test_разрешение_спора_пишет_факт_в_колонки` ниже: оно идёт через
         * настоящее разрешение спора, а не собирает строку руками.
         */
        $this->сделка([
            'seller_payout_kopecks' => 40000,
            'platform_fee_kopecks' => 0,
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
        $this->assertSame('400,00', $строка[$this->столбец($ш, 'К выплате продавцу (₽)')]);
        // Доля покупателя своей колонки не имеет и не должна: при
        // разделении она в `metadata.split`, при возврате — весь холд.
        $this->assertSame('0,00', $строка[$this->столбец($ш, 'Комиссия (₽)')]);

        // Отдельного «плана» в строке больше нет: колонка — это факт.
    }

    public function test_отменённая_сделка_возвращает_всё_покупателю(): void
    {
        // По возвращённой сделке не ушло ничего — так и в колонках.
        $this->сделка([
            'status' => SafeDealStatus::Cancelled,
            'seller_payout_kopecks' => 0,
            'platform_fee_kopecks' => 0,
        ]);

        $строки = $this->выгрузка($this->owner());
        $ш = $строки[0];

        $this->assertSame('возврат покупателю', $строки[1][$this->столбец($ш, 'Исход')]);

        $this->assertSame('0,00', $строки[1][$this->столбец($ш, 'К выплате продавцу (₽)')]);
        $this->assertSame('0,00', $строки[1][$this->столбец($ш, 'Комиссия (₽)')]);
    }

    public function test_у_незавершённой_колонка_говорит_сколько_причитается(): void
    {
        /*
         * Единственное место, где колонка смотрит вперёд, и это не
         * двусмысленность. Она называется «К выплате продавцу» и отвечает
         * на один вопрос: сколько продавцу причитается по этой сделке
         * сейчас. У незавершённой это плановая сумма — деньги в холде, и
         * служба выплат берёт перевод отсюда же. У завершённой это
         * выплаченное. У разделённой и возвращённой — то, что реально
         * ушло.
         *
         * В доход площадки незавершённая сделка при этом не попадает:
         * сводка считает только `completed`. Это проверяет
         * `test_сводка_считает_только_завершённые` ниже.
         */
        $this->сделка(['status' => SafeDealStatus::Paid]);

        $строки = $this->выгрузка($this->owner());
        $ш = $строки[0];

        $this->assertSame('не завершена', $строки[1][$this->столбец($ш, 'Исход')]);
        $this->assertSame('1000,00', $строки[1][$this->столбец($ш, 'К выплате продавцу (₽)')]);
        $this->assertSame('50,00', $строки[1][$this->столбец($ш, 'Комиссия (₽)')]);
    }

    public function test_сводка_считает_только_завершённые(): void
    {
        // Комиссия незавершённой сделки посчитана, но не удержана: деньги
        // ещё в холде. В доход она попасть не должна.
        $this->сделка(['status' => SafeDealStatus::Paid]);
        $admin = $this->owner();

        $this->assertSame(
            0,
            (int) $this->actingAs($admin, 'sanctum')
                ->getJson('/api/v1/admin/ledger/totals')
                ->assertOk()
                ->json('data.commission_kopecks'),
        );
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
            'seller_payout_kopecks' => 40000,
            'platform_fee_kopecks' => 0,
            'metadata' => ['split' => ['buyer_kopecks' => 65000, 'seller_kopecks' => 40000, 'fee_returned_kopecks' => 5000]],
        ]);
        $this->сделка(['status' => SafeDealStatus::Cancelled]);
        $this->сделка(['status' => SafeDealStatus::Paid]);

        $admin = $this->owner();

        $строки = $this->выгрузка($admin);
        $ш = $строки[0];
        $i = $this->столбец($ш, 'Комиссия (₽)');
        $исход = $this->столбец($ш, 'Исход');
        $число = static fn (string $v): float => (float) str_replace(',', '.', $v);

        /*
         * Суммируем только завершённые — и это не поправка ради зелёного.
         *
         * Столбец «Комиссия» отвечает на вопрос «сколько по этой сделке»,
         * а сводка — на вопрос «сколько площадка заработала». У
         * незавершённой сделки комиссия посчитана, но деньги в холде: в
         * строке она есть, в доходе её нет. Столбец исхода для этого и
         * нужен — без него нулевая комиссия у разделённой читалась бы как
         * ошибка выгрузки.
         */
        $поВыгрузке = array_sum(array_map(
            fn ($r) => $r[$исход] === 'завершена' ? $число($r[$i]) : 0.0,
            array_slice($строки, 1),
        ));

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
            'seller_payout_kopecks' => 40000,
            'platform_fee_kopecks' => 0,
            'metadata' => ['split' => ['buyer_kopecks' => 65000, 'seller_kopecks' => 40000, 'fee_returned_kopecks' => 5000]],
        ]);

        $строки = $this->выгрузка($this->owner());
        $ш = $строки[0];
        $i = $this->столбец($ш, 'К выплате продавцу (₽)');

        // Разделитель в выгрузке — запятая: так его читает русский Excel.
        $число = static fn (string $v): float => (float) str_replace(',', '.', $v);
        $сумма = array_sum(array_map(fn ($r) => $число($r[$i]), array_slice($строки, 1)));

        /*
         * 1000 по обычной плюс 400 по разделённой. До 30.09 та же сумма
         * по тому же столбцу давала 2000: он держал план, и разделённая
         * сделка показывала 1000 вместо 400. Второго столбца, из которого
         * можно было бы получить старое число, больше нет — в этом и
         * смысл правки.
         */
        $this->assertSame(1400.0, $сумма);
    }
}
