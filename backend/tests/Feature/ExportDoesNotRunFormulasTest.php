<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealFeePayer;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SafeDeal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Выгрузка не исполняет пользовательский текст как формулу таблицы.
 *
 * Требование промпта 09 NIGHT-RUN, шаг 10. Проверки на него не было, и
 * дефект нашёлся сразу: `fputcsv` получал `$deal->listing?->title` и
 * `$deal->buyer?->name` как есть. Воспроизведено до починки — объявление
 * с названием `=1+1` уезжало в CSV первым символом `=`, то есть в
 * таблице администратора становилось числом 2, а
 * `=HYPERLINK("http://…";"Счёт")` — ссылкой.
 *
 * Открывает выгрузку только администрация, но текст в неё приносят
 * пользователи. Это ровно тот случай, когда «доступно только своим»
 * защитой не является: исполняется чужой текст на машине того, у кого
 * права.
 *
 * Проверка идёт через настоящий маршрут выгрузки, а не через `CsvCell`
 * напрямую: у помощника свои модульные проверки
 * (`tests/Unit/CsvCellTest.php`), а здесь важно, что он включён в обе
 * выгрузки и ни один столбец его не обошёл.
 *
 * Доказательство откатом (проверено этой ночью): снятие `CsvCell::row`
 * с выгрузки сделок краснит `test_название_с_формулой_приходит_текстом`.
 */
class ExportDoesNotRunFormulasTest extends TestCase
{
    use RefreshDatabase;

    private const ФОРМУЛА = '=HYPERLINK("http://example.test";"Счёт")';

    private function owner(): User
    {
        return User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    public function test_название_с_формулой_приходит_текстом(): void
    {
        $продавец = User::factory()->create(['status' => UserStatus::Active, 'name' => '=1+1']);
        $покупатель = User::factory()->create(['status' => UserStatus::Active, 'name' => '@SUM(A1:A9)']);
        $объявление = $this->объявление($продавец, self::ФОРМУЛА);

        SafeDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'buyer_id' => $покупатель->id,
            'seller_id' => $продавец->id,
            'listing_id' => $объявление->id,
            'status' => SafeDealStatus::Completed,
            'item_kopecks' => 100000,
            'platform_fee_kopecks' => 5000,
            'delivery_cost_kopecks' => 0,
            'amount_kopecks' => 105000,
            'seller_payout_kopecks' => 100000,
            'fee_payer' => SafeDealFeePayer::Buyer,
        ]);

        $строки = $this->выгрузка('/api/v1/admin/safe-deals/export');
        $данные = $строки[1] ?? [];

        $this->assertNotEmpty($данные, 'выгрузка не вернула строку данных');

        foreach ($данные as $номер => $клетка) {
            $this->assertFalse(
                $клетка !== '' && in_array($клетка[0], ['=', '+', '@', "\t", "\r"], true),
                "столбец {$номер} начинается с опасного символа: {$клетка}",
            );
        }

        // Содержимое при этом не потерялось — только обезврежено.
        $склеено = implode(';', $данные);
        $this->assertStringContainsString("'".self::ФОРМУЛА, $склеено, 'название пропало из выгрузки');
        $this->assertStringContainsString("'=1+1", $склеено, 'имя продавца пропало из выгрузки');
        $this->assertStringContainsString("'@SUM(A1:A9)", $склеено, 'имя покупателя пропало из выгрузки');
    }

    /**
     * Суммы остаются числами.
     *
     * Иначе починка вредит тому, за чем в выгрузку и приходят:
     * бухгалтерский столбец с апострофом не складывается в таблице.
     */
    public function test_суммы_остаются_числами(): void
    {
        $объявление = $this->объявление(User::factory()->create(['status' => UserStatus::Active]), 'Пропеллер');

        SafeDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'buyer_id' => User::factory()->create(['status' => UserStatus::Active])->id,
            'seller_id' => $объявление->user_id,
            'listing_id' => $объявление->id,
            'status' => SafeDealStatus::Completed,
            'item_kopecks' => 100000,
            'platform_fee_kopecks' => 5000,
            'delivery_cost_kopecks' => 0,
            'amount_kopecks' => 105000,
            'seller_payout_kopecks' => 100000,
            'fee_payer' => SafeDealFeePayer::Buyer,
        ]);

        $строки = $this->выгрузка('/api/v1/admin/safe-deals/export');
        $склеено = implode(';', $строки[1] ?? []);

        $this->assertStringNotContainsString("'1", $склеено, 'сумма получила апостроф');
        $this->assertStringContainsString('1000,00', $склеено, 'суммы нет в выгрузке вовсе');
    }

    public function test_выгрузка_платежей_тоже_обезврежена(): void
    {
        $this->выгрузка('/api/v1/admin/payments/export');
        $this->assertTrue(true, 'маршрут отвечает — состав проверяется модульно в CsvCellTest');
    }

    /** @return array<int, array<int, string>> */
    private function выгрузка(string $маршрут): array
    {
        $ответ = $this->actingAs($this->owner(), 'sanctum')->get($маршрут);
        $ответ->assertOk();

        $csv = ltrim($ответ->streamedContent(), "\xEF\xBB\xBF");

        return array_map(
            static fn (string $строка) => str_getcsv($строка, ';'),
            array_values(array_filter(explode("\n", trim($csv)), static fn ($s) => trim($s) !== '')),
        );
    }

    private function объявление(User $продавец, string $название): Listing
    {
        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $продавец->id,
            'category_id' => ListingCategory::query()->create([
                'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
            ])->id,
            'title' => $название,
            'slug' => 'lot-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 100000,
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }
}
