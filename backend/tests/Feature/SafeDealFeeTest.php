<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Services\SafeDealFeePolicy;
use Modules\Billing\Services\SafeDealService;
use Tests\TestCase;

/**
 * Комиссия безопасной сделки — одно число на странице и в расчёте.
 *
 * До 13.09 страница тарифов читала `escrow.fee.*` и обещала «не менее 300 ₽»,
 * а сервер считал по другому ключу ровно 5 % без минимума: на сделке в
 * 1 000 ₽ страница называла 300, а удерживалось 50 (приёмка 13.09, D4).
 * Здесь закреплено, что оба читают одну политику.
 */
class SafeDealFeeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['billing.safe_deal.escrow_provider' => 'wallet']);
    }

    /** @param array<string, array<string, mixed>> $settings */
    private function settings(array $settings): void
    {
        foreach ($settings as $key => $value) {
            SystemSetting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'group' => 'pricing']);
        }
    }

    private function listing(int $priceCents): Listing
    {
        $seller = User::factory()->create();
        $category = ListingCategory::query()->create(['name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1]);

        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Лот',
            'slug' => 'lot-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => $priceCents,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }

    /** Комиссия так, как её прочитает человек со страницы тарифов. */
    private function feeFromTariffsPage(int $itemCents): int
    {
        $fee = $this->getJson('/api/v1/public/tariffs')->assertOk()->json('data.safe_deal');
        $value = (int) round($itemCents * (float) $fee['percent'] / 100);
        $value = max($value, (int) $fee['min_cents']);

        return $fee['max_cents'] !== null ? min($value, (int) $fee['max_cents']) : $value;
    }

    public function test_page_and_checkout_give_the_same_fee_without_minimum(): void
    {
        $this->settings([
            'escrow.fee.percent' => ['percent' => 5],
            'escrow.fee.min_cents' => ['min_cents' => 0],
        ]);

        // 500, 1 000, 5 000 и 50 000 ₽ — копейки.
        foreach ([50000 => 2500, 100000 => 5000, 500000 => 25000, 5000000 => 250000] as $item => $expected) {
            $quote = app(SafeDealService::class)->quoteForListing($this->listing($item));

            $this->assertSame($expected, $quote['platform_fee_kopecks'], "расчёт сделки на {$item}");
            $this->assertSame($expected, $this->feeFromTariffsPage($item), "страница тарифов на {$item}");
            $this->assertSame($item - $expected, $quote['seller_payout_kopecks']);
        }
    }

    public function test_minimum_and_maximum_from_settings_apply_to_checkout(): void
    {
        $this->settings([
            'escrow.fee.percent' => ['percent' => 5],
            'escrow.fee.min_cents' => ['min_cents' => 30000],
            'escrow.fee.max_cents' => ['max_cents' => 100000],
        ]);

        foreach ([100000 => 30000, 5000000 => 100000, 1000000 => 50000] as $item => $expected) {
            $quote = app(SafeDealService::class)->quoteForListing($this->listing($item));
            $this->assertSame($expected, $quote['platform_fee_kopecks']);
            $this->assertSame($expected, $this->feeFromTariffsPage($item));
        }
    }

    public function test_fee_never_exceeds_the_item_price(): void
    {
        $this->settings(['escrow.fee.percent' => ['percent' => 5], 'escrow.fee.min_cents' => ['min_cents' => 30000]]);

        $this->assertSame(10000, app(SafeDealFeePolicy::class)->feeFor(10000));
    }

    public function test_disabled_fee_is_zero(): void
    {
        $this->settings(['escrow.fee.enabled' => ['enabled' => false], 'escrow.fee.percent' => ['percent' => 5]]);

        $this->assertSame(0, app(SafeDealService::class)->quoteForListing($this->listing(500000))['platform_fee_kopecks']);
    }

    public function test_without_settings_the_default_minimum_is_zero(): void
    {
        $this->assertSame(0, $this->getJson('/api/v1/public/tariffs')->json('data.safe_deal.min_cents'));
        $this->assertSame(5000, app(SafeDealFeePolicy::class)->feeFor(100000));
    }
}
