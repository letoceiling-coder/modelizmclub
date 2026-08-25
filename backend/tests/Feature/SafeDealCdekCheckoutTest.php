<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SellerDeliveryProfile;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserReview;
use Database\Seeders\DeliveryMethodsSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Billing\Services\WalletService;
use Modules\User\Services\UserRatingService;
use Tests\TestCase;

class SafeDealCdekCheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(DeliveryMethodsSeeder::class);
        config([
            'cdek.enabled' => true,
            'cdek.test' => true,
            'cdek.api_url_test' => 'https://api.edu.cdek.ru/v2/',
            'billing.safe_deal.platform_fee_percent' => 5,
        ]);
        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.listing_payment_enabled'],
            ['value' => ['enabled' => false], 'group' => 'feature'],
        );
    }

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

    private function seedCdekListing(User $seller, int $priceCents = 100000): Listing
    {
        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ]);

        SellerDeliveryProfile::create([
            'user_id' => $seller->id,
            'provider' => 'cdek',
            'point_type' => 'pickup_point',
            'external_point_id' => 'MSK1',
            'label' => 'Отправка',
            'address' => ['city_code' => 44],
            'is_default' => true,
            'is_active' => true,
        ]);

        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Модель с СДЭК',
            'slug' => 'cdek-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => $priceCents,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
            'delivery_methods' => ['СДЭК'],
            'package_size' => 'm',
            'weight_kg' => 2,
            'dimensions_cm' => ['length' => 30, 'width' => 20, 'height' => 15],
        ]);
    }

    private function fakeCdekQuote(float $sum = 350.0): void
    {
        Http::fake([
            'api.edu.cdek.ru/v2/oauth/token*' => Http::response([
                'access_token' => 'cdek-token',
                'expires_in' => 3600,
            ]),
            'api.edu.cdek.ru/v2/calculator/tarifflist' => Http::response([
                'tariff_codes' => [
                    ['tariff_code' => 136, 'delivery_sum' => $sum],
                ],
            ]),
            'api.edu.cdek.ru/v2/orders' => Http::response([
                'entity' => [
                    'uuid' => 'cdek-order-uuid',
                    'cdek_number' => '1234567890',
                    'statuses' => [['code' => 'CREATED']],
                ],
            ]),
        ]);
    }

    public function test_cdek_listing_requires_parcel_or_preset(): void
    {
        $user = $this->seedUser('seller');
        $categoryId = ListingCategory::query()->create([
            'name' => 'Kits',
            'slug' => 'kits-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ])->id;

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Без габаритов',
                'description' => str_repeat('Описание объявления. ', 5),
                'category_id' => $categoryId,
                'price_cents' => 10_000,
                'delivery_methods' => ['СДЭК'],
                'publish' => false,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['package_size']);
    }

    public function test_pickup_requires_address(): void
    {
        $user = $this->seedUser('seller');
        $categoryId = ListingCategory::query()->create([
            'name' => 'Kits',
            'slug' => 'kits-p-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ])->id;

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Самовывоз без адреса',
                'description' => str_repeat('Описание объявления. ', 5),
                'category_id' => $categoryId,
                'price_cents' => 10_000,
                'delivery_methods' => ['Самовывоз'],
                'publish' => false,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['pickup_address']);
    }

    public function test_quote_and_create_holds_item_plus_rounded_delivery(): void
    {
        $this->fakeCdekQuote(351.0);
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedCdekListing($seller);
        app(WalletService::class)->credit($buyer, 200000, WalletTransactionType::Topup, 'test');

        $destination = [
            'city_code' => 137,
            'external_point_id' => 'SPB1',
            'name' => 'ПВЗ СПб',
            'address' => 'Невский, 1',
        ];

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal/quote", [
                'destination_point' => $destination,
            ])
            ->assertOk()
            ->assertJsonPath('data.item_kopecks', 100000)
            ->assertJsonPath('data.platform_fee_kopecks', 5000)
            ->assertJsonPath('data.delivery_cost_kopecks', 40000)
            ->assertJsonPath('data.hold_kopecks', 140000);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", [
                'accept_terms' => true,
                'destination_point' => $destination,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.delivery_cost_kopecks', 40000)
            ->assertJsonPath('data.amount_kopecks', 140000);

        $wallet = app(WalletService::class)->wallet($buyer->fresh());
        $this->assertSame(60000, (int) $wallet->balance_kopecks);
        $this->assertSame(140000, (int) $wallet->held_kopecks);
    }

    public function test_cdek_create_requires_terms_and_pvz(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedCdekListing($seller);
        app(WalletService::class)->credit($buyer, 200000, WalletTransactionType::Topup, 'test');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['accept_terms']);
    }

    public function test_cdek_webhook_updates_deal_delivery_status(): void
    {
        $this->fakeCdekQuote(350.0);
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedCdekListing($seller);
        app(WalletService::class)->credit($buyer, 200000, WalletTransactionType::Topup, 'test');

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", [
                'accept_terms' => true,
                'destination_point' => [
                    'city_code' => 137,
                    'external_point_id' => 'SPB1',
                    'name' => 'ПВЗ СПб',
                ],
            ])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/ship")
            ->assertOk()
            ->assertJsonPath('data.tracking_number', '1234567890');

        $this->postJson('/api/v1/webhooks/cdek/order-status', [
            'uuid' => 'cdek-order-uuid',
            'cdek_number' => '1234567890',
            'status' => ['code' => 'ACCEPTED_AT_PICK_UP_POINT'],
        ])->assertOk();

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.delivery_status', 'at_pickup')
            ->assertJsonPath('data.status', 'shipped');
    }

    public function test_rating_counts_only_completed_safe_deals(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => ListingCategory::query()->create([
                'name' => 'RC',
                'slug' => 'rc-r-'.uniqid(),
                'sort_order' => 1,
                'is_active' => true,
            ])->id,
            'title' => 'Without cdek',
            'slug' => 'plain-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
        app(WalletService::class)->credit($buyer, 100000, WalletTransactionType::Topup, 'test');

        UserReview::query()->create([
            'uuid' => (string) Str::uuid(),
            'author_id' => $buyer->id,
            'target_user_id' => $seller->id,
            'rating' => 5,
            'text' => 'fake',
        ]);

        $ratings = app(UserRatingService::class)->aggregate($seller->id);
        $this->assertSame(0, $ratings['count']);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal")
            ->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/review", ['rating' => 4, 'text' => 'ok'])
            ->assertCreated();

        $ratings = app(UserRatingService::class)->aggregate($seller->id);
        $this->assertSame(1, $ratings['count']);
        $this->assertSame(4.0, $ratings['average']);
    }
}
