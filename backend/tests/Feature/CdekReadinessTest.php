<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SellerDeliveryProfile;
use App\Models\User;
use App\Support\CdekReadiness;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Предложение и возможность сходятся сами.
 *
 * На 25.09 СДЭК был указан у четырёх опубликованных объявлений, и ни у
 * одного продавца не было ни габаритов, ни пункта отправки. Покупатель
 * выбирал способ, доходил до расчёта и получал отказ — честный, но после
 * того, как он уже выбрал.
 */
class CdekReadinessTest extends TestCase
{
    use RefreshDatabase;

    private function продавец(): User
    {
        return User::factory()->create(['status' => UserStatus::Active]);
    }

    private function объявление(User $seller, bool $измерено): Listing
    {
        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => ListingCategory::query()->create([
                'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
            ])->id,
            'title' => 'Набор',
            'slug' => 'nabor-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
            'delivery_methods' => ['СДЭК', 'Самовывоз'],
            'dimensions_cm' => $измерено ? ['length' => 30, 'width' => 20, 'height' => 15] : null,
            'weight_kg' => $измерено ? 2 : null,
        ]);
    }

    private function пункт(User $seller): void
    {
        SellerDeliveryProfile::query()->create([
            'user_id' => $seller->id,
            'provider' => 'cdek',
            'point_type' => 'pickup_point',
            'external_point_id' => 'MSK1',
            'label' => 'Отправка',
            'address' => ['city_code' => 44],
            'is_default' => true,
            'is_active' => true,
        ]);
    }

    public function test_both_conditions_are_needed(): void
    {
        $seller = $this->продавец();

        $без = $this->объявление($seller, false);
        $this->assertFalse(CdekReadiness::ready($без));
        $this->assertContains(CdekReadiness::НЕТ_ГАБАРИТОВ, CdekReadiness::missing($без));
        $this->assertContains(CdekReadiness::НЕТ_ПУНКТА, CdekReadiness::missing($без));

        $измерено = $this->объявление($seller, true);
        $this->assertFalse(CdekReadiness::ready($измерено), 'габариты есть, пункта нет');

        $this->пункт($seller);
        $this->assertTrue(CdekReadiness::ready($измерено->fresh()), 'сошлись оба условия');
    }

    /** Покупателю невыполнимый способ не показывается. */
    public function test_a_buyer_does_not_see_cdek_until_it_can_be_done(): void
    {
        $seller = $this->продавец();
        $listing = $this->объявление($seller, false);
        $buyer = User::factory()->create(['status' => UserStatus::Active]);

        $ответ = $this->actingAs($buyer, 'sanctum')
            ->getJson('/api/v1/listings/'.$listing->uuid)
            ->assertOk();

        $this->assertSame(['Самовывоз'], $ответ->json('data.delivery_methods'));
        $this->assertFalse($ответ->json('data.offers_cdek'));
        $this->assertNull($ответ->json('data.cdek_hint'), 'подсказка не для покупателя');
    }

    /** Владельцу способ виден как есть — он правит объявление. */
    public function test_the_owner_still_sees_what_he_chose(): void
    {
        $seller = $this->продавец();
        $listing = $this->объявление($seller, false);

        $ответ = $this->actingAs($seller, 'sanctum')
            ->getJson('/api/v1/listings/'.$listing->uuid)
            ->assertOk();

        $this->assertContains('СДЭК', $ответ->json('data.delivery_methods'));
        $this->assertStringContainsString('габариты', (string) $ответ->json('data.cdek_hint'));
    }

    /** Подсказка называет именно то, чего не хватает. */
    public function test_the_hint_names_what_is_missing(): void
    {
        $seller = $this->продавец();

        $без = $this->объявление($seller, false);
        $this->assertStringContainsString('габариты', (string) CdekReadiness::hint($без));
        $this->assertStringContainsString('пункт отправки', (string) CdekReadiness::hint($без));

        $this->пункт($seller);
        $этот = $this->объявление($seller, false);
        $подсказка = (string) CdekReadiness::hint($этот->fresh());
        $this->assertStringContainsString('габариты', $подсказка);
        $this->assertStringNotContainsString('пункт отправки', $подсказка, 'пункт есть — про него молчим');
    }

    /**
     * Список не превращается в запрос на каждое объявление.
     *
     * `ListingResource` отдаётся постранично, и проверка пункта отправки
     * без памятки дала бы по запросу на лот: двадцать объявлений — двадцать
     * лишних обращений к базе на каждой странице каталога.
     */
    public function test_a_listing_page_does_not_query_per_row(): void
    {
        $seller = $this->продавец();
        for ($i = 0; $i < 8; $i++) {
            $this->объявление($seller, true);
        }
        $buyer = User::factory()->create(['status' => UserStatus::Active]);

        CdekReadiness::forget();
        $запросы = 0;
        DB::listen(function ($q) use (&$запросы): void {
            if (str_contains($q->sql, 'seller_delivery_profiles')) {
                $запросы++;
            }
        });

        $this->actingAs($buyer, 'sanctum')
            ->getJson('/api/v1/listings?per_page=8')
            ->assertOk();

        $this->assertLessThanOrEqual(
            1,
            $запросы,
            "на восемь объявлений одного продавца ушло {$запросы} запросов за пунктом отправки",
        );
    }

    /** Объявление без СДЭК эти условия не касаются. */
    public function test_a_listing_without_cdek_is_never_blocked(): void
    {
        $seller = $this->продавец();
        $listing = $this->объявление($seller, false);
        $listing->forceFill(['delivery_methods' => ['Самовывоз']])->save();

        $this->assertTrue(CdekReadiness::ready($listing->fresh()));
        $this->assertNull(CdekReadiness::hint($listing->fresh()));
    }
}
