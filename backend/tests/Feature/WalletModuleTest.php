<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\WithdrawalRequest;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Internal wallet ledger, top-up, withdraw and wallet-balance payments (spec v4.0 §T2/§T4).
 */
class WalletModuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        config(['billing.provider' => 'stub']);
    }

    private function seedUser(string $suffix = 'a'): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active, 'email_verified_at' => now()]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => "User {$suffix}",
            'slug' => "user-{$suffix}-".uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);
        $user->assignRole('user');

        return $user;
    }

    private function seedPlan(): SubscriptionPlan
    {
        return SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'year'],
            ['name' => 'Год', 'price_cents' => 99000, 'period_days' => 365, 'is_active' => true, 'sort_order' => 1],
        );
    }

    public function test_wallet_balance_starts_at_zero(): void
    {
        $user = $this->seedUser();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/wallet')
            ->assertOk()
            ->assertJsonPath('balance_kopecks', 0);
    }

    public function test_topup_via_stub_credits_wallet_on_confirm(): void
    {
        $user = $this->seedUser();

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/wallet/topup', ['amount' => 500])
            ->assertCreated()
            ->json('data.payment_uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/payments/{$uuid}/confirm-stub")
            ->assertOk();

        $this->assertSame(50000, app(WalletService::class)->balanceKopecks($user->fresh()));

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/wallet/transactions')
            ->assertOk()
            ->assertJsonPath('data.0.kind', WalletTransactionType::Topup->value);
    }

    public function test_pay_subscription_from_wallet_balance(): void
    {
        $plan = $this->seedPlan();
        $user = $this->seedUser();
        app(WalletService::class)->credit($user, 99000, WalletTransactionType::Topup, 'seed');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year', 'pay_with' => 'wallet'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.provider', 'wallet');

        $this->assertSame(0, app(WalletService::class)->balanceKopecks($user->fresh()));
        $this->assertDatabaseHas('user_subscriptions', [
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
        ]);
    }

    public function test_pay_subscription_from_wallet_fails_without_balance(): void
    {
        $this->seedPlan();
        $user = $this->seedUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year', 'pay_with' => 'wallet'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['pay_with']);
    }

    public function test_withdraw_debits_balance_and_creates_request(): void
    {
        $user = $this->seedUser();
        app(WalletService::class)->credit($user, 100000, WalletTransactionType::Topup, 'seed');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/wallet/withdraw', [
                'amount' => 500,
                'method' => 'card',
                'destination' => '4111111111111111',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $this->assertSame(50000, app(WalletService::class)->balanceKopecks($user->fresh()));
        $this->assertDatabaseHas('withdrawal_requests', ['user_id' => $user->id, 'status' => 'pending']);
    }

    public function test_withdraw_rejects_when_insufficient(): void
    {
        $user = $this->seedUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/wallet/withdraw', [
                'amount' => 500,
                'method' => 'card',
                'destination' => '4111111111111111',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'insufficient_funds');
    }

    public function test_admin_reject_withdrawal_refunds_balance(): void
    {
        $admin = $this->seedUser('admin');
        $admin->syncRoles(['admin']);
        $user = $this->seedUser('u');
        app(WalletService::class)->credit($user, 100000, WalletTransactionType::Topup, 'seed');

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/wallet/withdraw', [
                'amount' => 500,
                'method' => 'card',
                'destination' => '4111111111111111',
            ])
            ->json('data.uuid');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/withdrawals/{$uuid}", ['status' => 'rejected'])
            ->assertOk();

        $this->assertSame(100000, app(WalletService::class)->balanceKopecks($user->fresh()));
    }

    public function test_wallet_debit_is_atomic_and_rejects_overspend(): void
    {
        $user = $this->seedUser();
        $wallet = app(WalletService::class);
        $wallet->credit($user, 10000, WalletTransactionType::Topup, 'seed');

        $this->expectException(\Modules\Billing\Exceptions\InsufficientFundsException::class);
        $wallet->debit($user, 20000, WalletTransactionType::Withdrawal, 'too much');
    }
}
