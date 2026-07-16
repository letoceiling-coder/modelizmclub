<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SavedPaymentMethod;
use App\Models\User;
use App\Models\UserPayoutRequisites;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SellerCabinetTest extends TestCase
{
    use RefreshDatabase;

    private function userWithProfile(): User
    {
        $user = User::factory()->create([
            'password' => 'password123',
        ]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Seller',
            'slug' => 'seller-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function category(): ListingCategory
    {
        return ListingCategory::create([
            'name' => 'Двигатели',
            'slug' => 'parts-'.uniqid(),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
    }

    public function test_subscription_plans_seeder_slugs(): void
    {
        $this->seed(\Database\Seeders\SubscriptionPlansSeeder::class);

        $this->assertDatabaseHas('subscription_plans', ['slug' => 'month', 'price_cents' => 9900]);
        $this->assertDatabaseHas('subscription_plans', ['slug' => 'half', 'price_cents' => 49900]);
        $this->assertDatabaseHas('subscription_plans', ['slug' => 'year', 'price_cents' => 79900]);
    }

    public function test_change_password_and_logout_others(): void
    {
        $user = $this->userWithProfile();
        $tokenA = $user->createToken('a')->plainTextToken;
        $user->createToken('b');

        $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->postJson('/api/v1/account/change-password', [
                'current_password' => 'password123',
                'new_password' => 'NewPassword999!',
            ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertTrue(Hash::check('NewPassword999!', $user->fresh()->password));

        $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->postJson('/api/v1/auth/logout-others')
            ->assertOk();

        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_profile_accepts_phone_and_socials(): void
    {
        $user = $this->userWithProfile();
        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/users/me', [
            'phone' => '+79001234567',
            'vk_url' => 'https://vk.com/test',
            'telegram_url' => 'https://t.me/test',
            'website_url' => 'https://example.com',
        ])
            ->assertOk()
            ->assertJsonPath('data.phone', '+79001234567')
            ->assertJsonPath('data.vk_url', 'https://vk.com/test');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'phone' => '+79001234567']);
        $this->assertDatabaseHas('user_profiles', [
            'user_id' => $user->id,
            'vk_url' => 'https://vk.com/test',
        ]);
    }

    public function test_payout_requisites_mask_full_number(): void
    {
        $user = $this->userWithProfile();
        Sanctum::actingAs($user);

        $this->putJson('/api/v1/account/payout-requisites', [
            'card_number' => '4111111111111111',
        ])->assertOk();

        $this->getJson('/api/v1/account/payout-requisites')
            ->assertOk()
            ->assertJsonPath('data.card_last4', '1111')
            ->assertJsonMissingPath('data.card_number');

        $stored = UserPayoutRequisites::query()->find($user->id);
        $this->assertNotSame('4111111111111111', $stored->getRawOriginal('payout_card_number'));
        $this->assertSame('4111111111111111', $stored->payout_card_number);
    }

    public function test_wallet_balance_and_transactions(): void
    {
        $user = $this->userWithProfile();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/wallet')
            ->assertOk()
            ->assertJsonPath('balance', 0)
            ->assertJsonPath('currency', 'RUB');

        $this->getJson('/api/v1/wallet/transactions')
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_seller_stats_aggregate(): void
    {
        $user = $this->userWithProfile();
        $category = $this->category();
        Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'category_id' => $category->id,
            'title' => 'Test',
            'slug' => 'test-'.uniqid(),
            'description' => 'd',
            'price_cents' => 10000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'views_count' => 10,
            'favorites_count' => 2,
            'published_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/users/me/stats')
            ->assertOk()
            ->assertJsonPath('active', 1)
            ->assertJsonPath('views_total', 10)
            ->assertJsonPath('favorites_total', 2);
    }

    public function test_boost_packages_and_promote_stub_checkout(): void
    {
        config(['billing.provider' => 'stub']);
        $this->seed(\Database\Seeders\BoostPackagesSeeder::class);

        $user = $this->userWithProfile();
        $category = $this->category();
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'category_id' => $category->id,
            'title' => 'Boost me',
            'slug' => 'boost-'.uniqid(),
            'description' => 'd',
            'price_cents' => 10000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);

        $this->getJson('/api/v1/listings/boost-packages')
            ->assertOk()
            ->assertJsonPath('data.0.id', 'boost-7');

        Sanctum::actingAs($user);

        $this->postJson("/api/v1/listings/{$listing->uuid}/promote", [
            'package' => 'boost-7',
            'idempotency_key' => 'boost-'.uniqid(),
        ])
            ->assertCreated()
            ->assertJsonPath('data.provider', 'stub');
    }

    public function test_listing_resource_includes_promotion_flags(): void
    {
        $user = $this->userWithProfile();
        $category = $this->category();
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'category_id' => $category->id,
            'title' => 'Promoted',
            'slug' => 'promoted-'.uniqid(),
            'description' => 'd',
            'price_cents' => 10000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'paid_until' => now()->addDays(7),
            'published_at' => now(),
        ]);

        $this->getJson("/api/v1/listings/{$listing->uuid}")
            ->assertOk()
            ->assertJsonPath('data.is_promoted', true)
            ->assertJsonPath('data.promoted_until', $listing->paid_until->toIso8601String());
    }

    public function test_payment_methods_list_empty_and_stub_binding(): void
    {
        config(['billing.provider' => 'stub']);
        $user = $this->userWithProfile();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/account/payment-methods')
            ->assertOk()
            ->assertJsonPath('data', []);

        $this->postJson('/api/v1/account/payment-methods')
            ->assertCreated()
            ->assertJsonStructure(['data' => ['binding_url']]);

        SavedPaymentMethod::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'provider' => 'stub',
            'provider_token' => 'tok',
            'brand' => 'visa',
            'last4' => '4242',
        ]);

        $this->deleteJson('/api/v1/account/payment-methods/'.SavedPaymentMethod::first()->uuid)
            ->assertOk();

        $this->assertDatabaseCount('saved_payment_methods', 0);
    }

    public function test_view_history_record_list_and_clear(): void
    {
        $user = $this->userWithProfile();
        Sanctum::actingAs($user);

        $targetUuid = (string) Str::uuid();

        $this->postJson('/api/v1/me/view-history', [
            'id' => $targetUuid,
            'kind' => 'ad',
            'title' => 'Test listing',
            'thumb' => null,
        ])->assertOk();

        $this->getJson('/api/v1/me/view-history')
            ->assertOk()
            ->assertJsonPath('data.0.id', $targetUuid)
            ->assertJsonPath('data.0.kind', 'ad');

        $this->deleteJson('/api/v1/me/view-history')
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->getJson('/api/v1/me/view-history')
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_soft_deleted_listing_appears_in_my_listings_and_can_be_restored(): void
    {
        $user = $this->userWithProfile();
        $category = $this->category();
        Sanctum::actingAs($user);

        $listing = Listing::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'title' => 'To delete',
            'slug' => 'to-delete-'.uniqid(),
            'description' => 'Test',
            'price_cents' => 10000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'category_id' => $category->id,
            'published_at' => now(),
        ]);

        $this->deleteJson("/api/v1/listings/{$listing->uuid}")
            ->assertOk();

        $this->getJson('/api/v1/users/me/listings')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $listing->uuid)
            ->assertJsonPath('data.0.deleted_at', fn ($v) => $v !== null);

        $this->postJson("/api/v1/listings/{$listing->uuid}/restore")
            ->assertOk()
            ->assertJsonPath('data.uuid', $listing->uuid)
            ->assertJsonPath('data.deleted_at', null);

        $this->assertNull($listing->fresh()->deleted_at);
    }
}
