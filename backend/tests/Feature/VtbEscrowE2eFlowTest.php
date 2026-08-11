<?php

namespace Tests\Feature;

use App\Enums\EscrowDealStatus;
use App\Enums\ListingStatus;
use App\Enums\ShipmentStatus;
use App\Enums\UserStatus;
use App\Models\EscrowDeal;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Payment;
use App\Models\Shipment;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use Database\Seeders\EscrowSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Billing\Services\EscrowShipmentSync;
use Tests\TestCase;

/**
 * Full VTB escrow happy-path: checkout → pay → ship → confirm → money ledger.
 */
class VtbEscrowE2eFlowTest extends TestCase
{
    use RefreshDatabase;

    private const ITEM_CENTS = 150_000;

    private const DELIVERY_CENTS = 50_000;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(EscrowSettingsSeeder::class);
        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.escrow_enabled'],
            ['value' => ['enabled' => true], 'group' => 'features'],
        );
        config([
            'billing.provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'test-api',
            'billing.vtb.password' => 'test-pass',
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
            'billing.vtb.escrow_mode' => 'single',
            'billing.vtb.callback_token' => null,
        ]);
    }

    public function test_full_vtb_escrow_flow_with_money_movement_report(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, self::ITEM_CENTS);

        Http::fake([
            'vtb.test/*register.do*' => Http::response([
                'orderId' => 'vtb-e2e-order-1',
                'formUrl' => 'https://vtb.test/pay/form',
            ]),
            'vtb.test/*getOrderStatusExtended.do*' => Http::response(['orderStatus' => 2]),
        ]);

        $quote = $this->getJson('/api/v1/escrow/quote?listing_uuid='.$listing->uuid.'&delivery_cents='.self::DELIVERY_CENTS)
            ->assertOk()
            ->json('data');

        $this->assertSame('vtb', $quote['provider']);
        $this->assertSame(self::ITEM_CENTS, $quote['item_cents']);
        $this->assertSame(self::DELIVERY_CENTS, $quote['delivery_cents']);
        $this->assertSame(30_000, $quote['platform_fee_cents']);
        $this->assertSame(120_000, $quote['seller_payout_cents']);
        $this->assertSame(200_000, $quote['total_cents']);

        $checkout = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/escrow/checkout", [
                'delivery_amount_cents' => self::DELIVERY_CENTS,
            ])
            ->assertCreated()
            ->json('data');

        $deal = EscrowDeal::query()->where('uuid', $checkout['escrow_uuid'])->firstOrFail();

        // VTB webhook: payment deposited (single-stage)
        $this->postJson('/api/v1/payments/webhooks/vtb', [
            'mdOrder' => 'vtb-e2e-order-1',
            'operation' => 'deposited',
            'status' => 1,
        ])->assertOk();

        $deal->refresh();
        $this->assertSame(EscrowDealStatus::AwaitingShipment, $deal->status);
        $this->assertSame(200_000, $deal->captured_cents);

        // Seller ships → delivered
        $shipment = Shipment::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'seller_id' => $seller->id,
            'buyer_id' => $buyer->id,
            'provider' => 'cdek',
            'status' => ShipmentStatus::Created,
            'delivery_cost_cents' => self::DELIVERY_CENTS,
            'currency' => 'RUB',
            'weight_kg' => 1.0,
        ]);
        $deal->update(['shipment_id' => $shipment->id]);

        $sync = app(EscrowShipmentSync::class);
        $shipment->update(['status' => ShipmentStatus::InTransit]);
        $sync->onShipmentUpdated($shipment->fresh());
        $shipment->update(['status' => ShipmentStatus::Delivered, 'delivered_at' => now()]);
        $sync->onShipmentUpdated($shipment->fresh());

        $deal->refresh();
        $this->assertSame(EscrowDealStatus::AwaitingBuyerConfirm, $deal->status);

        // Buyer confirms receipt
        Http::fake([
            'vtb.test/*getOrderStatusExtended.do*' => Http::response(['orderStatus' => 2]),
        ]);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/escrow/{$deal->uuid}/confirm-receipt")
            ->assertOk();

        $deal->refresh();
        $listing->refresh();

        $this->assertSame(EscrowDealStatus::Completed, $deal->status);
        $this->assertSame(ListingStatus::Sold, $listing->status);
        $this->assertSame(200_000, $deal->captured_cents);
        $this->assertSame(120_000, $deal->paid_out_cents);
        $this->assertSame(30_000, $deal->platform_fee_cents);

        $report = [
            'buyer_paid_rub' => '2 000.00',
            'item_rub' => '1 500.00',
            'delivery_rub' => '500.00',
            'platform_fee_rub' => '300.00',
            'seller_payout_rub' => '1 200.00',
            'captured_rub' => '2 000.00',
            'paid_out_rub' => '1 200.00',
        ];

        $out = base_path('../docs/qa/vtb-escrow-e2e-flow-test-report.json');
        @mkdir(dirname($out), 0755, true);
        file_put_contents($out, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->assertSame('2 000.00', $report['buyer_paid_rub']);
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

    private function seedListing(User $seller, int $priceCents): Listing
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
            'title' => 'E2E VTB model',
            'slug' => 'e2e-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => $priceCents,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }
}
