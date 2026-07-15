<?php

namespace Tests\Feature;

use App\Enums\EscrowDealStatus;
use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use App\Models\UserPayoutRequisites;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class EscrowDealTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(string $suffix = 'a'): User
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

    private function seedListing(User $seller): Listing
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
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Active,
            'published_at' => now(),
        ]);
    }

    public function test_escrow_checkout_requires_seller_payout_card(): void
    {
        config([
            'billing.provider' => 'yookassa',
            'billing.yookassa.enabled' => true,
            'billing.yookassa.shop_id' => '1405539',
            'billing.yookassa.secret_key' => 'secret',
            'billing.yookassa.api_url' => 'https://yookassa.test/v3',
            'billing.safe_deal.enabled' => true,
        ]);

        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/escrow/checkout")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['seller']);
    }

    public function test_escrow_checkout_creates_deal_and_payment(): void
    {
        config([
            'billing.provider' => 'yookassa',
            'billing.yookassa.enabled' => true,
            'billing.yookassa.shop_id' => '1405539',
            'billing.yookassa.secret_key' => 'secret',
            'billing.yookassa.api_url' => 'https://yookassa.test/v3',
            'billing.safe_deal.enabled' => true,
            'billing.safe_deal.platform_fee_percent' => 5,
        ]);

        Http::fake([
            'yookassa.test/v3/deals' => Http::response(['id' => 'deal-1', 'type' => 'safe_deal'], 200),
            'yookassa.test/v3/payments' => Http::response([
                'id' => 'pay-1',
                'status' => 'pending',
                'confirmation' => ['confirmation_url' => 'https://yookassa.test/pay/1'],
            ], 200),
        ]);

        $seller = $this->seedUser('seller');
        UserPayoutRequisites::query()->create([
            'user_id' => $seller->id,
            'payout_card_number' => '4111111111111111',
        ]);
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);

        $response = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/escrow/checkout")
            ->assertCreated()
            ->assertJsonPath('data.provider', 'yookassa')
            ->assertJsonPath('data.checkout_url', 'https://yookassa.test/pay/1');

        $this->assertDatabaseHas('escrow_deals', [
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'status' => EscrowDealStatus::PendingPayment->value,
            'yookassa_deal_id' => 'deal-1',
        ]);

        $escrowUuid = $response->json('data.escrow_uuid');

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/escrow/{$escrowUuid}")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_payment');
    }
}
