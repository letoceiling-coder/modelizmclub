<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ListingPromotion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Listing\Services\ListingBoostService;
use Tests\TestCase;

/**
 * Число запросов на ленте объявлений не зависит от числа карточек.
 *
 * `ListingResource` спрашивает `ListingBoostService::promotedUntil`, а тот
 * брал наибольший `paid_until` по акциям отдельным запросом на каждое
 * объявление. Замерено аудитом 26.09 на `/api/v1/listings`: per_page 1 —
 * 10 запросов, 5 — 15, 20 — 30, 50 — 60. Лента объявлений — главная
 * страница сервиса, и рост здесь линейный от числа карточек, а не от
 * числа посетителей.
 */
class ListingIndexQueryCountTest extends TestCase
{
    use RefreshDatabase;

    private function засеять(int $сколько, bool $сАкциями = false): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $category = ListingCategory::create([
            'name' => 'Двигатели',
            'slug' => 'motors-count',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        for ($i = 0; $i < $сколько; $i++) {
            $listing = Listing::create([
                'user_id' => $user->id,
                'category_id' => $category->id,
                'title' => "Объявление {$i}",
                'slug' => Str::slug("Объявление {$i}").'-'.uniqid(),
                'description' => 'Описание',
                'price_cents' => 100_00 + $i,
                'status' => ListingStatus::Published,
                'published_at' => now()->subMinutes($i),
            ]);

            // Акция не у каждого: важен именно случай «объявление без акций».
            // Предзагруженный атрибут у такого равен null, и признак
            // предзагрузки должен быть `array_key_exists`, а не `isset` —
            // с `isset` путь уходил бы в запрос на каждое объявление без
            // акции, то есть почти на весь каталог, и все проверки числа
            // запросов остались бы зелёными. Найдено ревью 26.09.
            if ($сАкциями && $i % 2 === 0) {
                ListingPromotion::query()->create([
                    'listing_id' => $listing->id,
                    'type' => 'boost',
                    'paid_until' => now()->addDays(3),
                ]);
            }
        }
    }

    private function запросовНаЛенте(int $perPage): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();

        $this->getJson("/api/v1/listings?per_page={$perPage}")->assertOk();

        $всего = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $всего;
    }

    public function test_число_запросов_не_растёт_с_числом_карточек(): void
    {
        $this->засеять(20, сАкциями: true);

        $одна = $this->запросовНаЛенте(1);
        $двадцать = $this->запросовНаЛенте(20);

        $this->assertSame(
            $одна,
            $двадцать,
            "Одна карточка — {$одна} запросов, двадцать — {$двадцать}. ".
            'Значит что-то спрашивается на каждое объявление отдельно.',
        );
    }

    /**
     * Предзагруженное значение должно давать тот же ответ, что и запрос.
     *
     * Иначе оптимизация меняет поведение: `is_promoted` и `promoted_until`
     * в ленте начали бы расходиться с карточкой объявления.
     */
    public function test_предзагруженное_значение_совпадает_с_запросом(): void
    {
        $this->засеять(4, сАкциями: true);

        $лента = $this->getJson('/api/v1/listings?per_page=4')->assertOk()->json('data');

        $this->assertCount(4, $лента);

        $сАкцией = 0;

        foreach ($лента as $карточка) {
            if ($карточка['promoted_until'] === null) {
                $this->assertFalse(
                    $карточка['is_promoted'],
                    'объявление без акции не должно считаться продвигаемым',
                );

                continue;
            }

            $сАкцией++;
            $this->assertTrue(
                $карточка['is_promoted'],
                'объявление с действующей акцией должно считаться продвигаемым',
            );

            $одно = $this->getJson("/api/v1/listings/{$карточка['uuid']}")->assertOk()->json('data');

            $this->assertSame(
                $карточка['promoted_until'],
                $одно['promoted_until'],
                'срок продвижения в ленте и в карточке должен совпадать',
            );
        }

        $this->assertSame(2, $сАкцией, 'в посеве должно быть ровно две акции из четырёх');
    }

    /**
     * Продление акции считается от текущего срока, а не от устаревшего.
     *
     * `activate` спрашивает `promotedUntil` с `allowPreloaded: false`: если
     * объявление пришло из списка с предзагруженным значением, оно могло
     * устареть, и человек получил бы не то число дней, за которое заплатил.
     */
    public function test_продление_не_берёт_устаревшее_предзагруженное(): void
    {
        $this->засеять(1, сАкциями: true);

        $listing = Listing::query()->withMax('promotions', 'paid_until')->firstOrFail();

        // Срок вырос после того, как список был загружен.
        ListingPromotion::query()->create([
            'listing_id' => $listing->id,
            'type' => 'boost',
            'paid_until' => now()->addDays(30),
        ]);

        app(ListingBoostService::class)->activate($listing, 5);

        $итог = $listing->fresh()->paid_until;

        $this->assertNotNull($итог);
        $this->assertSame(
            now()->addDays(35)->toDateString(),
            $итог->toDateString(),
            'продление должно считаться от текущих 30 дней (итого 35), а не от '.
            'предзагруженных 3 (итого 8); получилось '.$итог->toDateString(),
        );
    }
}
