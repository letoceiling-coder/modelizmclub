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
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminEscrowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::findOrCreate('admin');
        $this->seed(EscrowSettingsSeeder::class);
    }

    private function adminUser(): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Admin',
            'slug' => 'admin-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);
        $user->assignRole('admin');

        return $user;
    }

    private function seedDeal(): EscrowDeal
    {
        $seller = User::factory()->create(['status' => UserStatus::Active]);
        $buyer = User::factory()->create(['status' => UserStatus::Active]);
        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
        ]);
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Deal listing',
            'slug' => 'deal-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => 100_000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);

        return EscrowDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount_cents' => 100_000,
            'item_amount_cents' => 100_000,
            'seller_payout_cents' => 70_000,
            'platform_fee_cents' => 30_000,
            'currency' => 'RUB',
            'status' => EscrowDealStatus::Funded,
            'payment_provider' => 'vtb',
            'vtb_order_id' => 'vtb-order-1',
            'paid_at' => now(),
        ]);
    }

    public function test_admin_lists_escrow_deals(): void
    {
        $this->seedDeal();

        $this->actingAs($this->adminUser(), 'sanctum')
            ->getJson('/api/v1/admin/escrow')
            ->assertOk()
            ->assertJsonStructure(['data' => [['uuid', 'status', 'listing', 'buyer', 'seller']]]);
    }

    public function test_admin_fee_preview(): void
    {
        $this->actingAs($this->adminUser(), 'sanctum')
            ->getJson('/api/v1/admin/escrow/fee-preview?item_cents=50000')
            ->assertOk()
            ->assertJsonPath('data.platform_fee_cents', 30_000);
    }

    public function test_admin_freeze_and_unfreeze(): void
    {
        $deal = $this->seedDeal();

        $this->actingAs($this->adminUser(), 'sanctum')
            ->postJson("/api/v1/admin/escrow/{$deal->uuid}/freeze", [
                'reason' => 'Проверка документов по сделке',
            ])
            ->assertOk()
            ->assertJsonPath('data.frozen', true);

        $this->actingAs($this->adminUser(), 'sanctum')
            ->postJson("/api/v1/admin/escrow/{$deal->uuid}/unfreeze", [
                'reason' => 'Проверка завершена успешно',
            ])
            ->assertOk()
            ->assertJsonPath('data.frozen', false);
    }

    public function test_admin_vtb_reverse(): void
    {
        config([
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'u',
            'billing.vtb.password' => 'p',
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
        ]);

        Http::fake(['vtb.test/*' => Http::response(['errorCode' => '0'])]);

        $deal = $this->seedDeal();

        $this->actingAs($this->adminUser(), 'sanctum')
            ->postJson("/api/v1/admin/escrow/{$deal->uuid}/reverse", [
                'reason' => 'Отмена сделки по запросу покупателя',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'reversed');
    }
}
