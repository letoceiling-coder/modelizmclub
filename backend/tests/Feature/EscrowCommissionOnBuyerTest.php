<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealFeePayer;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SafeDeal;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Billing\Services\SafeDealService;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Комиссию безопасной сделки платит покупатель, а продавец получает цену.
 *
 * Было: товар 1 000 ₽ — покупатель платил 1 000, комиссия 50 удерживалась из
 * выплаты, продавец получал 950. Решение заказчика 27.09: безопасную сделку
 * выбирает покупатель, значит и платит он. Теперь покупатель платит 1 050,
 * продавец получает 1 000 — ровно ту цену, которую указал в объявлении.
 *
 * СТАРЫЕ СДЕЛКИ НЕ ПЕРЕСЧИТЫВАЮТСЯ — прямое требование заказчика, поэтому в
 * базе две схемы одновременно. Различает их колонка `fee_payer`; почему не
 * дата и не пустота новых полей — в `App\Enums\SafeDealFeePayer`.
 *
 * Тесты ниже закрепляют пять величин, обе схемы и все четыре развязки:
 * завершение, отмена, спор в пользу покупателя и спор с делением.
 */
class EscrowCommissionOnBuyerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['billing.safe_deal.escrow_provider' => 'wallet']);
        SystemSetting::query()->updateOrCreate(
            ['key' => 'escrow.fee.percent'],
            ['value' => ['percent' => 5], 'group' => 'pricing'],
        );
        SystemSetting::query()->updateOrCreate(
            ['key' => 'escrow.fee.min_cents'],
            ['value' => ['min_cents' => 0], 'group' => 'pricing'],
        );
    }

    private function человек(string $имя, UserRole $role = UserRole::User): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active, 'role' => $role]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => Str::slug($имя).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function объявление(User $seller, int $цена): Listing
    {
        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => ListingCategory::query()->create([
                'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
            ])->id,
            'title' => 'Лот',
            'slug' => 'lot-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => $цена,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }

    private function пополнить(User $user, int $копейки): void
    {
        app(WalletService::class)->credit($user, $копейки, WalletTransactionType::Topup, 'проба');
    }

    private function баланс(User $user): int
    {
        return app(WalletService::class)->balanceKopecks($user->fresh());
    }

    /** Сделка на указанную цену, оплаченная из кошелька. */
    private function сделка(int $цена, ?User $buyer = null, ?User $seller = null): SafeDeal
    {
        $seller ??= $this->человек('Продавец');
        $buyer ??= $this->человек('Покупатель');
        $listing = $this->объявление($seller, $цена);
        $this->пополнить($buyer, (int) round($цена * 1.05));

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.uuid');

        return SafeDeal::query()->where('uuid', $uuid)->firstOrFail();
    }

    /**
     * Арифметика на трёх суммах: 500, 1 000 и 5 000 ₽.
     *
     * Пять величин проверяются каждая отдельно, а не через одну сумму: именно
     * подмена одной величины другой и была прежней схемой.
     */
    public function test_арифметика_на_трёх_суммах(): void
    {
        foreach ([50000 => 2500, 100000 => 5000, 500000 => 25000] as $цена => $комиссия) {
            $расчёт = app(SafeDealService::class)
                ->quoteForListing($this->объявление($this->человек('Продавец'), $цена));

            $this->assertSame($цена, $расчёт['item_kopecks'], "товар на {$цена}");
            $this->assertSame($комиссия, $расчёт['platform_fee_kopecks'], "комиссия на {$цена}");
            $this->assertSame(0, $расчёт['delivery_cost_kopecks'], "доставка на {$цена}");
            $this->assertSame($цена + $комиссия, $расчёт['total_kopecks'], "итог покупателя на {$цена}");
            $this->assertSame($цена, $расчёт['seller_payout_kopecks'], "выплата продавцу на {$цена}");
        }
    }

    /** Пять величин доезжают до строки сделки — раздельно, а не одной суммой. */
    public function test_пять_величин_хранятся_раздельно(): void
    {
        $deal = $this->сделка(100000);

        $this->assertSame(100000, (int) $deal->item_kopecks, 'стоимость товара');
        $this->assertSame(5000, (int) $deal->platform_fee_kopecks, 'комиссия');
        $this->assertSame(0, (int) $deal->delivery_cost_kopecks, 'доставка');
        $this->assertSame(105000, (int) $deal->amount_kopecks, 'итог покупателя');
        $this->assertSame(100000, (int) $deal->seller_payout_kopecks, 'к выплате продавцу');
        $this->assertSame(SafeDealFeePayer::Buyer, $deal->fee_payer, 'схема расчёта');
    }

    /**
     * Инвариант новой схемы: итог покупателя складывается из трёх слагаемых,
     * а выплата равна цене товара.
     */
    public function test_инвариант_новой_схемы(): void
    {
        $deal = $this->сделка(500000);

        $this->assertSame(
            (int) $deal->item_kopecks + (int) $deal->platform_fee_kopecks + (int) $deal->delivery_cost_kopecks,
            (int) $deal->amount_kopecks,
            'итог покупателя = товар + комиссия + доставка',
        );
        $this->assertSame((int) $deal->item_kopecks, (int) $deal->seller_payout_kopecks);
    }

    public function test_завершение_платит_продавцу_полную_цену(): void
    {
        $seller = $this->человек('Продавец');
        $buyer = $this->человек('Покупатель');
        $deal = $this->сделка(100000, $buyer, $seller);

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/ship", ['tracking_number' => 'TRK'])
            ->assertOk();
        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/confirm")
            ->assertOk();

        $this->assertSame(100000, $this->баланс($seller), 'продавцу — цена объявления без вычетов');
        $this->assertSame(0, $this->баланс($buyer), 'покупатель внёс ровно столько, сколько нужно');
    }

    /**
     * Отмена возвращает всё, включая комиссию.
     *
     * Комиссия лежит внутри удержания, поэтому возврат `amount_kopecks`
     * возвращает её сам. Проверка нужна именно потому, что это неочевидно:
     * увидев отдельную колонку комиссии, легко решить, что её надо вычесть.
     */
    public function test_отмена_возвращает_всё_включая_комиссию(): void
    {
        $buyer = $this->человек('Покупатель');
        $deal = $this->сделка(100000, $buyer);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/cancel")
            ->assertOk();

        $this->assertSame(105000, $this->баланс($buyer), 'вернуться должны и 1 000 товара, и 50 комиссии');
    }

    public function test_спор_в_пользу_покупателя_возвращает_и_комиссию(): void
    {
        $seller = $this->человек('Продавец');
        $buyer = $this->человек('Покупатель');
        $owner = $this->человек('Владелец', UserRole::Owner);
        $deal = $this->сделка(100000, $buyer, $seller);

        $dispute = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/dispute", ['reason' => 'not_received'])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/admin/disputes/{$dispute}/resolve", ['in_favor_of' => 'buyer'])
            ->assertOk();

        $this->assertSame(105000, $this->баланс($buyer));
        $this->assertSame(0, $this->баланс($seller));
    }

    /**
     * Спор с делением: делится товар, комиссия возвращается покупателю.
     *
     * Самый опасный случай — «всё продавцу». Делимое здесь 100 000, и продавец
     * получает ровно цену объявления; отдай ему всё удержание, он получил бы
     * 105 000, то есть площадка доплатила бы комиссию из своего.
     */
    public function test_спор_с_делением_не_делит_комиссию(): void
    {
        $seller = $this->человек('Продавец');
        $buyer = $this->человек('Покупатель');
        $owner = $this->человек('Владелец', UserRole::Owner);
        $deal = $this->сделка(100000, $buyer, $seller);

        $dispute = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/dispute", ['reason' => 'partial'])
            ->assertCreated()
            ->json('data.uuid');

        // Сумма удержания — не делимое: 105 000 отбивается.
        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/admin/disputes/{$dispute}/resolve", [
                'in_favor_of' => 'split',
                'buyer_kopecks' => 0,
                'seller_kopecks' => 105000,
            ])
            ->assertStatus(422);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/admin/disputes/{$dispute}/resolve", [
                'in_favor_of' => 'split',
                'buyer_kopecks' => 0,
                'seller_kopecks' => 100000,
            ])
            ->assertOk();

        $this->assertSame(100000, $this->баланс($seller), 'продавцу — цена объявления, не больше');
        $this->assertSame(5000, $this->баланс($buyer), 'комиссия вернулась покупателю');
        $this->assertSame(
            5000,
            (int) ($deal->fresh()->metadata['split']['fee_returned_kopecks'] ?? 0),
            'в журнале сделки видно, сколько ушло возвратом комиссии',
        );
    }

    /**
     * Сделка по старой схеме остаётся как была.
     *
     * Строка заводится прямой записью — так выглядят сделки, закрытые до
     * 27.09. Ни одна величина не пересчитывается, выплата остаётся
     * уменьшенной на комиссию, и бухгалтерия видит ту же комиссию, что
     * видела раньше.
     */
    public function test_старая_сделка_не_пересчитывается(): void
    {
        $seller = $this->человек('Продавец');
        $buyer = $this->человек('Покупатель');
        $owner = $this->человек('Владелец', UserRole::Owner);

        DB::table('safe_deals')->insert([
            'uuid' => $uuid = (string) Str::uuid(),
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount_kopecks' => 100000,
            'item_kopecks' => 100000,
            'platform_fee_kopecks' => 5000,
            'fee_payer' => SafeDealFeePayer::Seller->value,
            'seller_payout_kopecks' => 95000,
            'currency' => 'RUB',
            'status' => SafeDealStatus::Completed->value,
            'completed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $deal = SafeDeal::query()->where('uuid', $uuid)->firstOrFail();

        $this->assertSame(100000, (int) $deal->amount_kopecks, 'покупатель заплатил цену товара');
        $this->assertSame(95000, (int) $deal->seller_payout_kopecks, 'из выплаты вычтена комиссия');
        $this->assertSame(SafeDealFeePayer::Seller, $deal->fee_payer);

        // Бухгалтерия считает комиссию по колонке — число то же, что и раньше.
        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/admin/ledger/totals')
            ->assertOk()
            ->assertJsonPath('data.commission_kopecks', 5000);

        // И карточка сделки объясняет её прежней схемой, а не новой.
        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.fee_payer', 'seller')
            ->assertJsonPath('data.seller_payout_kopecks', 95000);
    }

    /**
     * Миграция переносит цену товара из JSON и не меняет ни одной суммы.
     *
     * До 27.09 цена товара лежала в `metadata.item_kopecks`: бухгалтерия её
     * оттуда не сложит и не отберёт по ней строки, а в выгрузке она
     * восстанавливалась вычитанием. Перенос проверяется на самой миграции:
     * колонке возвращается NULL, в таблицу кладётся строка в прежнем виде, и
     * миграция проигрывается заново.
     */
    public function test_миграция_переносит_цену_товара_и_не_трогает_суммы(): void
    {
        $seller = $this->человек('Продавец');
        $buyer = $this->человек('Покупатель');

        DB::statement('alter table safe_deals alter column item_kopecks drop not null');

        $вставить = function (array $поля) use ($buyer, $seller): string {
            DB::table('safe_deals')->insert(array_merge([
                'uuid' => $uuid = (string) Str::uuid(),
                'buyer_id' => $buyer->id,
                'seller_id' => $seller->id,
                'platform_fee_kopecks' => 5000,
                'fee_payer' => SafeDealFeePayer::Seller->value,
                'currency' => 'RUB',
                'status' => SafeDealStatus::Completed->value,
                'created_at' => now(),
                'updated_at' => now(),
            ], $поля));

            return $uuid;
        };

        // Обычная старая сделка: цена товара есть в metadata.
        $сJson = $вставить([
            'amount_kopecks' => 140000,
            'delivery_cost_kopecks' => 40000,
            'seller_payout_kopecks' => 95000,
            'item_kopecks' => null,
            'metadata' => json_encode(['item_kopecks' => 100000], JSON_UNESCAPED_UNICODE),
        ]);

        // Строка без metadata — ранние демо-данные и ручные правки.
        $безJson = $вставить([
            'amount_kopecks' => 130000,
            'delivery_cost_kopecks' => 30000,
            'seller_payout_kopecks' => 95000,
            'item_kopecks' => null,
            'metadata' => null,
        ]);

        $миграция = require base_path('database/migrations/2026_09_27_140000_safe_deal_commission_paid_by_buyer.php');
        $миграция->up();

        $первая = SafeDeal::query()->where('uuid', $сJson)->firstOrFail();
        $вторая = SafeDeal::query()->where('uuid', $безJson)->firstOrFail();

        $this->assertSame(100000, (int) $первая->item_kopecks, 'цена взята из metadata');
        $this->assertSame(
            100000,
            (int) $вторая->item_kopecks,
            'без metadata цена восстанавливается как итог минус доставка',
        );

        // И ни одна сумма не пересчитана — прямое требование заказчика.
        $this->assertSame(140000, (int) $первая->amount_kopecks);
        $this->assertSame(5000, (int) $первая->platform_fee_kopecks);
        $this->assertSame(95000, (int) $первая->seller_payout_kopecks, 'выплата осталась уменьшенной');
        $this->assertSame(SafeDealFeePayer::Seller, $первая->fee_payer);
    }

    /** Выгрузка для бухгалтерии содержит все пять величин и схему расчёта. */
    public function test_выгрузка_содержит_пять_величин(): void
    {
        $owner = $this->человек('Владелец', UserRole::Owner);
        $this->сделка(100000);

        $ответ = $this->actingAs($owner, 'sanctum')->get('/api/v1/admin/safe-deals/export');
        $ответ->assertOk();

        $csv = $ответ->streamedContent();
        $строки = array_values(array_filter(explode("\n", trim($csv))));
        $заголовок = str_getcsv($строки[0], ';');
        $строка = str_getcsv($строки[1], ';');

        foreach (['Товар (₽)', 'Комиссия (₽)', 'Комиссию платит', 'Итог покупателя (₽)', 'К выплате продавцу (₽)', 'Доставка (₽)'] as $столбец) {
            $this->assertContains($столбец, $заголовок, "в выгрузке нет столбца «{$столбец}»");
        }

        $поле = fn (string $имя) => $строка[array_search($имя, $заголовок, true)];

        $this->assertSame('1000,00', $поле('Товар (₽)'));
        $this->assertSame('50,00', $поле('Комиссия (₽)'));
        $this->assertSame('1050,00', $поле('Итог покупателя (₽)'));
        $this->assertSame('1000,00', $поле('К выплате продавцу (₽)'));
        $this->assertSame('покупатель при оформлении', $поле('Комиссию платит'));
    }
}
