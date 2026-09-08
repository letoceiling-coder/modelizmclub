<?php

namespace Tests\Feature;

use App\Models\ListingPricingRule;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Стоимость платных услуг — публично и из настроек.
 *
 * Страница тарифов нужна банку-эквайеру и статье 10 ЗоЗПП. Главное, что здесь
 * закреплено, — цена берётся оттуда же, откуда её берёт оплата. Таблица,
 * набранная руками в тексте документа, разошлась бы с действительностью при
 * первом изменении тарифа, а на этот документ ссылается оферта.
 */
class PublicTariffsTest extends TestCase
{
    use RefreshDatabase;

    private function seedPrices(): void
    {
        SubscriptionPlan::query()->create([
            'slug' => 'month', 'name' => 'Месяц', 'price_cents' => 9900,
            'period_days' => 30, 'is_active' => true, 'sort_order' => 1,
        ]);
        SubscriptionPlan::query()->create([
            'slug' => 'year', 'name' => 'Год', 'price_cents' => 59900,
            'period_days' => 365, 'is_active' => true, 'sort_order' => 3,
        ]);
        // Отключённый тариф на витрине не показывается.
        SubscriptionPlan::query()->create([
            'slug' => 'legacy', 'name' => 'Старый', 'price_cents' => 49900,
            'period_days' => 30, 'is_active' => false, 'sort_order' => 9,
        ]);

        ListingPricingRule::query()->create([
            'duration_days' => 7, 'base_price_cents' => 14900,
            'settings' => ['type' => 'boost', 'package_id' => 'boost-7', 'label' => '7 дней'],
        ]);

        foreach ([
            'listing.placement.registered_price_cents' => ['cents' => 3000],
            'listing.placement.subscriber_default_price_cents' => ['cents' => 2000],
            'escrow.fee.percent' => ['percent' => 5],
            'escrow.fee.min_cents' => ['min_cents' => 30000],
        ] as $key => $value) {
            SystemSetting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'group' => 'pricing']);
        }
    }

    public function test_tariffs_are_public(): void
    {
        $this->seedPrices();

        $this->getJson('/api/v1/public/tariffs')
            ->assertOk()
            ->assertJsonStructure(['data' => ['subscriptions', 'placement', 'boost', 'safe_deal', 'currency']]);
    }

    public function test_prices_come_from_the_same_place_as_checkout(): void
    {
        $this->seedPrices();

        $data = $this->getJson('/api/v1/public/tariffs')->assertOk()->json('data');

        $this->assertSame(9900, $data['subscriptions'][0]['price_cents']);
        $this->assertSame(3000, $data['placement']['without_subscription_cents']);
        $this->assertSame(2000, $data['placement']['with_subscription_cents']);
        $this->assertSame(14900, $data['boost'][0]['price_cents']);
        // JSON роняет `.0`: 5.0 приезжает целым. Сравниваем значение, а не тип —
        // процент может быть и дробным (5.5), и приедет тогда числом с точкой.
        $this->assertEquals(5, $data['safe_deal']['percent']);
        $this->assertSame(30000, $data['safe_deal']['min_cents']);
    }

    public function test_changing_a_price_in_settings_changes_the_page(): void
    {
        $this->seedPrices();

        SystemSetting::query()->updateOrCreate(
            ['key' => 'listing.placement.registered_price_cents'],
            ['value' => ['cents' => 4500], 'group' => 'pricing'],
        );

        // Ровно то, ради чего цена не пишется в текст: поменяли в админке —
        // поменялось на странице, без выкатки.
        $this->getJson('/api/v1/public/tariffs')
            ->assertOk()
            ->assertJsonPath('data.placement.without_subscription_cents', 4500);
    }

    public function test_disabled_plan_is_not_shown(): void
    {
        $this->seedPrices();

        $slugs = array_column($this->getJson('/api/v1/public/tariffs')->json('data.subscriptions'), 'slug');

        $this->assertSame(['month', 'year'], $slugs);
    }

    public function test_missing_settings_fall_back_to_defaults_instead_of_failing(): void
    {
        // Пустая база — страница обязана открыться: пустой прайс лучше, чем
        // пятисотка на документе, на который ссылается банк.
        $this->getJson('/api/v1/public/tariffs')
            ->assertOk()
            ->assertJsonPath('data.subscriptions', [])
            ->assertJsonPath('data.safe_deal.percent', 5);
    }
}
