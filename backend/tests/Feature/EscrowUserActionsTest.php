<?php

namespace Tests\Feature;

use App\Enums\EscrowDealStatus;
use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\EscrowDeal;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use App\Models\UserProfile;
use Database\Seeders\EscrowSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class EscrowUserActionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        \App\Models\SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.escrow_enabled'],
            ['value' => ['enabled' => true], 'group' => 'features'],
        );
        $this->seed(EscrowSettingsSeeder::class);
        config([
            'billing.provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'test-api',
            'billing.vtb.password' => 'test-pass',
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
            'billing.vtb.escrow_mode' => 'single',
        ]);
    }

    private function user(string $suffix): User
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

    private function fundedDeal(): EscrowDeal
    {
        $seller = $this->user('seller');
        $buyer = $this->user('buyer');
        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
        ]);
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Escrow listing',
            'slug' => 'escrow-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => 50_000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);

        return EscrowDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount_cents' => 50_000,
            'item_amount_cents' => 50_000,
            'seller_payout_cents' => 35_000,
            'platform_fee_cents' => 15_000,
            'currency' => 'RUB',
            'status' => EscrowDealStatus::Funded,
            'payment_provider' => 'vtb',
            'vtb_order_id' => 'vtb-'.uniqid(),
            'paid_at' => now(),
        ]);
    }

    public function test_buyer_can_open_dispute(): void
    {
        $deal = $this->fundedDeal();
        $buyer = User::query()->findOrFail($deal->buyer_id);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/escrow/{$deal->uuid}/open-dispute", [
                'reason' => 'Товар не соответствует описанию на фото',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'dispute_open')
            ->assertJsonPath('data.dispute_status', 'open');

        $this->assertDatabaseHas('escrow_deals', [
            'id' => $deal->id,
            'status' => EscrowDealStatus::DisputeOpen->value,
            'dispute_status' => 'open',
        ]);
    }

    public function test_seller_can_mark_shipped(): void
    {
        $deal = $this->fundedDeal();
        $seller = User::query()->findOrFail($deal->seller_id);

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/escrow/{$deal->uuid}/mark-shipped", [
                'tracking_number' => 'TRACK123',
            ])
            ->assertOk()
            ->assertJsonPath('data.can_mark_shipped', false);

        $deal->refresh();
        $this->assertNotNull($deal->shipment_id);
        $this->assertDatabaseHas('shipments', [
            'id' => $deal->shipment_id,
            'tracking_number' => 'TRACK123',
        ]);
    }

    public function test_my_escrow_deals_lists_participant_deals(): void
    {
        $deal = $this->fundedDeal();
        $buyer = User::query()->findOrFail($deal->buyer_id);

        $this->actingAs($buyer, 'sanctum')
            ->getJson('/api/v1/users/me/escrow-deals?role=buyer')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.uuid', $deal->uuid)
            ->assertJsonStructure(['data' => [['uuid', 'status', 'can_open_dispute', 'listing']]]);
    }

    public function test_process_timeouts_dry_run(): void
    {
        $deal = $this->fundedDeal();
        $deal->update([
            'status' => EscrowDealStatus::PendingPayment,
            'paid_at' => null,
            'created_at' => now()->subDays(3),
        ]);

        $this->artisan('escrow:process-timeouts', ['--dry-run' => true])
            ->assertSuccessful();
    }
}
