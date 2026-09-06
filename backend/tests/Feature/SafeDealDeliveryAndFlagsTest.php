<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\DeliveryMethod;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SafeDeal;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\ParcelSize;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Выбор доставки, габариты посылки и согласованность флагов сделки.
 *
 * Проверяется то, что видит и получает пользователь: по каким размерам
 * посчитан тариф, можно ли забрать товар самовывозом, что сказано о деньгах
 * до оплаты и остаётся ли кнопка после того, как действие уже сделано.
 */
class SafeDealDeliveryAndFlagsTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(string $suffix): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => "User {$suffix}",
            'slug' => "user-{$suffix}-".uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    /** @param  list<string>  $methods */
    private function seedListing(User $seller, array $methods = [], int $priceCents = 100000): Listing
    {
        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
        ]);

        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Test listing',
            'slug' => 'test-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => $priceCents,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
            'delivery_methods' => $methods,
        ]);
    }

    private function fund(User $user, int $kopecks): void
    {
        app(WalletService::class)->credit($user, $kopecks, WalletTransactionType::Topup, 'test top-up');
    }

    // ── Пункт 4: габариты ────────────────────────────────────────────────

    public function test_measured_parcel_wins_over_the_preset(): void
    {
        $parcel = ParcelSize::resolve('m', ['length' => 45, 'width' => 30, 'height' => 20], 6.5);

        $this->assertSame(['length' => 45, 'width' => 30, 'height' => 20], $parcel['dimensions_cm']);
        $this->assertSame(6.5, $parcel['weight_kg']);
        $this->assertNull($parcel['package_size'], 'посылка измерена — типоразмер больше ничего не значит');
    }

    public function test_preset_applies_only_when_nothing_was_measured(): void
    {
        $parcel = ParcelSize::resolve('m', null, null);

        $this->assertSame(['length' => 30, 'width' => 20, 'height' => 15], $parcel['dimensions_cm']);
        $this->assertSame('m', $parcel['package_size']);
    }

    public function test_partial_measurements_fall_back_to_the_preset(): void
    {
        // Введены габариты, но забыт вес: считать по половине данных нельзя.
        $parcel = ParcelSize::resolve('l', ['length' => 45, 'width' => 30, 'height' => 20], 0);

        $this->assertSame('l', $parcel['package_size']);
        $this->assertSame(5.0, $parcel['weight_kg']);
    }

    public function test_listing_keeps_the_dimensions_the_seller_entered(): void
    {
        DeliveryMethod::query()->firstOrCreate(
            ['code' => 'cdek'],
            ['name' => 'СДЭК', 'is_active' => true, 'is_integrated' => true, 'sort_order' => 1],
        );

        \App\Models\SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.listing_payment_enabled'],
            ['value' => ['enabled' => false], 'group' => 'feature'],
        );

        $seller = $this->seedUser('seller');
        // Со СДЭК объявлению нужен город отправки — см. пункт 9.
        $city = \App\Models\City::query()->create(['name' => 'Москва', 'slug' => 'moskva-'.uniqid()]);

        $this->actingAs($seller, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Крупный набор',
                'city_id' => $city->id,
                'description' => 'Большая коробка, мерил сам.',
                'category_id' => ListingCategory::query()->create([
                    'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
                ])->id,
                'price_cents' => 500000,
                'delivery_methods' => ['СДЭК'],
                'package_size' => 'm',
                'dimensions_cm' => ['length' => 45, 'width' => 30, 'height' => 20],
                'weight_kg' => 6.5,
                'accept_rules' => true,
            ])
            ->assertCreated();

        $listing = Listing::query()->where('user_id', $seller->id)->firstOrFail();

        $this->assertSame(
            ['length' => 45, 'width' => 30, 'height' => 20],
            $listing->dimensions_cm,
            'введённые габариты не должны затираться пресетом при сохранении',
        );
        $this->assertSame(6.5, (float) $listing->weight_kg);
        $this->assertNull($listing->package_size, 'посылка измерена — типоразмер не записывается');
    }

    // ── Пункт 6: выбор способа доставки ──────────────────────────────────

    public function test_pickup_only_listing_needs_no_pickup_point(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, ['Самовывоз']);
        $this->fund($buyer, 100000);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->assertJsonPath('data.delivery_cost_kopecks', 0)
            ->assertJsonPath('data.delivery_method', 'Самовывоз');
    }

    public function test_buyer_may_pick_pickup_when_the_seller_also_offers_a_carrier(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, ['СДЭК', 'Самовывоз']);
        $this->fund($buyer, 100000);

        // Раньше здесь побеждал СДЭК и требовал ПВЗ: ветвление шло по набору
        // продавца, а выбора покупателя в модели сделки не было вовсе.
        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", [
                'accept_terms' => true,
                'delivery_method' => 'Самовывоз',
            ])
            ->assertCreated()
            ->assertJsonPath('data.delivery_method', 'Самовывоз')
            ->assertJsonPath('data.delivery_cost_kopecks', 0);
    }

    public function test_several_methods_require_an_explicit_choice(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, ['СДЭК', 'Самовывоз']);
        $this->fund($buyer, 100000);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['delivery_method']);
    }

    public function test_method_the_seller_does_not_offer_is_rejected(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, ['Самовывоз']);
        $this->fund($buyer, 100000);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", [
                'accept_terms' => true,
                'delivery_method' => 'СДЭК',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['delivery_method']);
    }

    public function test_pickup_deal_counts_seven_days_from_payment(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, ['Самовывоз']);
        $this->fund($buyer, 100000);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.uuid');

        // Отгрузки не будет, значит запустить отсчёт от неё нечему.
        $deal = SafeDeal::query()->where('uuid', $uuid)->firstOrFail();
        $this->assertNotNull($deal->auto_release_at);
        $this->assertSame(
            $deal->paid_at->addDays(7)->toDateString(),
            $deal->auto_release_at->toDateString(),
        );
    }

    // ── Пункт 3: обещание о деньгах ──────────────────────────────────────

    public function test_wallet_quote_does_not_promise_a_card_hold(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, ['Самовывоз']);
        $this->fund($buyer, 100000);

        // Кошелёк списывает сумму на счёт площадки; заморозки на карте нет.
        // Экран оформления и карточка сделки обязаны говорить одно и то же.
        $quote = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal/quote")
            ->assertOk()
            ->json('data.escrow_holds_on_card');

        $deal = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.escrow_holds_on_card');

        $this->assertFalse($quote);
        $this->assertSame($quote, $deal, 'расчёт и карточка не должны расходиться');
    }

    // ── Пункт 5: отмена неоплаченной сделки ──────────────────────────────

    public function test_unpaid_deal_can_be_cancelled_by_either_side(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, ['Самовывоз']);
        $this->fund($buyer, 100000);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.uuid');

        // Состояние банковского пути: покупатель не дошёл до формы оплаты.
        SafeDeal::query()->where('uuid', $uuid)->update(['status' => SafeDealStatus::Created]);
        $listing->forceFill(['reserved_at' => now()])->save();

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.can.cancel', true);

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $listing->refresh();
        $this->assertNull($listing->reserved_at, 'отмена до оплаты обязана освобождать объявление');
    }

    // ── Пункт 7: два поля с одним смыслом ────────────────────────────────

    public function test_review_flags_agree_before_and_after_the_review(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, ['Самовывоз']);
        $this->fund($buyer, 100000);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/confirm")
            ->assertOk();

        $before = $this->actingAs($buyer, 'sanctum')->getJson("/api/v1/safe-deals/{$uuid}")->assertOk();
        $this->assertTrue($before->json('data.can.review'));
        $this->assertTrue($before->json('data.can_review'));

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/review", ['rating' => 5, 'text' => 'Хорошо'])
            ->assertCreated();

        $after = $this->actingAs($buyer, 'sanctum')->getJson("/api/v1/safe-deals/{$uuid}")->assertOk();
        $this->assertFalse($after->json('data.can.review'), 'оценка уже оставлена');
        $this->assertSame($after->json('data.can.review'), $after->json('data.can_review'));
    }
}
