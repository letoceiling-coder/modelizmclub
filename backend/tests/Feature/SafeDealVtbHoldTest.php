<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealIncomingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Billing\Services\SafeDealHoldSyncService;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Safe deal backed by a real VTB card hold (spec v4.0 §5.2).
 *
 * The gateway is faked, so what is under test is our side of the two-stage
 * contract: the deal waits unpaid until VTB authorises, captures on completion
 * and reverses on cancellation — all without touching the buyer's wallet.
 */
class SafeDealVtbHoldTest extends TestCase
{
    use RefreshDatabase;

    /** Latest orderStatus the faked gateway reports; 0 = registered, unpaid. */
    private int $orderStatus = 0;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'billing.safe_deal.escrow_provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
            'billing.vtb.username' => 'merchant',
            'billing.vtb.password' => 'secret',
            'billing.vtb.token' => null,
        ]);

        $this->fakeGateway();
    }

    private function fakeGateway(): void
    {
        Http::fake(function (Request $request) {
            $url = $request->url();

            return match (true) {
                str_contains($url, 'registerPreAuth.do') => Http::response([
                    'orderId' => 'RBS-ORDER-1',
                    'formUrl' => 'https://vtb.test/payment/merchants/pay/RBS-ORDER-1',
                ]),
                str_contains($url, 'deposit.do') => tap(Http::response([]), fn () => $this->orderStatus = 2),
                str_contains($url, 'reverse.do') => tap(Http::response([]), fn () => $this->orderStatus = 3),
                str_contains($url, 'refund.do') => tap(Http::response([]), fn () => $this->orderStatus = 4),
                str_contains($url, 'getOrderStatusExtended.do') => Http::response([
                    'orderStatus' => $this->orderStatus,
                ]),
                default => Http::response([], 404),
            };
        });
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

    /** @return array{0: User, 1: User, 2: Listing, 3: string} */
    private function startDeal(): array
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->assertJsonPath('data.status', 'created')
            ->json('data.uuid');

        return [$seller, $buyer, $listing, $uuid];
    }

    /** VTB confirms the hold, as the buyer's 3-D Secure would. */
    private function authorizeHold(): void
    {
        $this->orderStatus = 1;

        $this->postJson('/api/v1/safe-deals/webhooks/vtb', ['mdOrder' => 'RBS-ORDER-1'])
            ->assertOk();
    }

    public function test_checkout_registers_a_hold_and_leaves_the_wallet_alone(): void
    {
        [, $buyer, $listing, $uuid] = $this->startDeal();

        $this->assertDatabaseHas('safe_deals', [
            'uuid' => $uuid,
            'status' => SafeDealStatus::Created->value,
        ]);
        $this->assertDatabaseHas('safe_deal_incoming_payments', [
            'rbs_order_id' => 'RBS-ORDER-1',
            'status' => SafeDealIncomingStatus::Pending->value,
            'capture_mode' => 'two_stage',
        ]);

        // No balance was required, and none was touched.
        $wallet = app(WalletService::class)->wallet($buyer->fresh());
        $this->assertSame(0, (int) $wallet->held_kopecks);

        // The listing is reserved while the buyer is on the bank's form.
        $this->assertNotNull($listing->fresh()->reserved_at);

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.checkout_url', 'https://vtb.test/payment/merchants/pay/RBS-ORDER-1');
    }

    public function test_webhook_authorization_marks_the_deal_paid(): void
    {
        [, $buyer, , $uuid] = $this->startDeal();

        $this->authorizeHold();

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $this->assertDatabaseHas('safe_deal_incoming_payments', [
            'rbs_order_id' => 'RBS-ORDER-1',
            'status' => SafeDealIncomingStatus::Authorized->value,
        ]);
    }

    public function test_confirmation_captures_the_hold_and_pays_the_seller(): void
    {
        [$seller, $buyer, $listing, $uuid] = $this->startDeal();
        $this->authorizeHold();

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/ship", ['tracking_number' => 'TRK-VTB'])
            ->assertOk();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'deposit.do')
            && (int) $request['amount'] === 100000);

        $this->assertDatabaseHas('safe_deal_incoming_payments', [
            'rbs_order_id' => 'RBS-ORDER-1',
            'status' => SafeDealIncomingStatus::Captured->value,
        ]);

        // Seller keeps 95% after commission; the buyer's wallet stayed empty.
        $this->assertSame(95000, app(WalletService::class)->balanceKopecks($seller->fresh()));
        $this->assertSame(0, app(WalletService::class)->balanceKopecks($buyer->fresh()));
        $this->assertNull($listing->fresh()->reserved_at);
    }

    public function test_cancellation_reverses_an_uncaptured_hold(): void
    {
        [, $buyer, $listing, $uuid] = $this->startDeal();
        $this->authorizeHold();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'reverse.do'));
        Http::assertNotSent(fn (Request $request) => str_contains($request->url(), 'refund.do'));

        $this->assertDatabaseHas('safe_deal_incoming_payments', [
            'rbs_order_id' => 'RBS-ORDER-1',
            'status' => SafeDealIncomingStatus::Reversed->value,
        ]);
        $this->assertNull($listing->fresh()->reserved_at);
    }

    public function test_abandoned_checkout_frees_the_listing(): void
    {
        [, , $listing, $uuid] = $this->startDeal();

        $this->travel(31)->minutes();

        $this->assertSame(1, app(SafeDealHoldSyncService::class)->expireStaleCheckouts());

        $this->assertDatabaseHas('safe_deals', [
            'uuid' => $uuid,
            'status' => SafeDealStatus::Cancelled->value,
        ]);
        $this->assertNull($listing->fresh()->reserved_at);
    }
}
