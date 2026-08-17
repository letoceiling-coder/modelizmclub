<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Wallet-based safe deal (escrow) flow — spec v4.0 §T5.
 */
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

    private function seedListing(User $seller, int $priceCents = 100000): Listing
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
        ]);
    }

    private function fund(User $user, int $kopecks): void
    {
        app(WalletService::class)->credit($user, $kopecks, WalletTransactionType::Topup, 'test top-up');
    }

    public function test_create_safe_deal_holds_buyer_funds(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        $this->fund($buyer, 100000);

        $response = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal")
            ->assertCreated()
            ->assertJsonPath('data.status', 'paid');

        $this->assertDatabaseHas('safe_deals', [
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'status' => SafeDealStatus::Paid->value,
        ]);

        // Buyer balance held, not spendable.
        $wallet = app(WalletService::class)->wallet($buyer->fresh());
        $this->assertSame(0, (int) $wallet->balance_kopecks);
        $this->assertSame(100000, (int) $wallet->held_kopecks);

        $uuid = $response->json('data.uuid');
        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');
    }

    public function test_create_safe_deal_requires_sufficient_balance(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['balance']);
    }

    public function test_full_flow_ship_confirm_pays_seller_minus_commission(): void
    {
        config(['billing.safe_deal.platform_fee_percent' => 5]);

        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        $this->fund($buyer, 100000);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal")
            ->json('data.uuid');

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/ship", ['tracking_number' => 'TRK1'])
            ->assertOk()
            ->assertJsonPath('data.status', 'shipped');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        // Seller receives 95%, platform keeps 5%.
        $this->assertSame(95000, app(WalletService::class)->balanceKopecks($seller->fresh()));
        $this->assertSame(0, (int) app(WalletService::class)->wallet($buyer->fresh())->held_kopecks);
    }

    public function test_cancel_refunds_buyer(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        $this->fund($buyer, 100000);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal")
            ->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertSame(100000, app(WalletService::class)->balanceKopecks($buyer->fresh()));
    }

    public function test_dispute_open_and_admin_resolves_for_buyer(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $admin = $this->seedUser('admin');
        $admin->update(['role' => UserRole::Admin]);
        $listing = $this->seedListing($seller);
        $this->fund($buyer, 100000);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal")
            ->json('data.uuid');

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/ship", ['tracking_number' => 'TRK2'])
            ->assertOk();

        $disputeUuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/dispute", ['reason' => 'not_received'])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/disputes/{$disputeUuid}/resolve", ['in_favor_of' => 'buyer'])
            ->assertOk();

        $this->assertSame(100000, app(WalletService::class)->balanceKopecks($buyer->fresh()));
        $this->assertSame(0, app(WalletService::class)->balanceKopecks($seller->fresh()));
    }

    public function test_delivery_webhook_marks_delivered(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        $this->fund($buyer, 100000);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal")
            ->json('data.uuid');

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/ship", ['tracking_number' => 'TRKWEB'])
            ->assertOk();

        $this->postJson('/api/v1/safe-deals/webhooks/delivery', [
            'tracking_number' => 'TRKWEB',
            'status' => 'delivered',
        ])->assertOk();

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.status', 'delivered');
    }
}
