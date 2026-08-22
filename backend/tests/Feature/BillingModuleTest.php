<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class BillingModuleTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Payer',
            'slug' => 'payer-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function seedPlan(string $slug = 'year'): SubscriptionPlan
    {
        return SubscriptionPlan::query()->updateOrCreate(
            ['slug' => $slug],
            [
                'name' => 'Год',
                'price_cents' => 99000,
                'period_days' => 365,
                'is_active' => true,
                'sort_order' => 2,
            ],
        );
    }

    public function test_public_plans_list(): void
    {
        SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'month'],
            [
                'name' => 'Месяц',
                'description' => 'Test',
                'price_cents' => 9900,
                'period_days' => 30,
                'is_active' => true,
                'sort_order' => 1,
            ],
        );

        $this->getJson('/api/v1/plans')
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'month');
    }

    public function test_public_plans_normalize_capability_features_to_list(): void
    {
        SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'month'],
            [
                'name' => 'Месяц',
                'description' => 'Test',
                'price_cents' => 9900,
                'period_days' => 30,
                'is_active' => true,
                'sort_order' => 1,
                'features' => ['posts' => 'unlimited', 'listings' => 'unlimited'],
            ],
        );

        $this->getJson('/api/v1/plans')
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'month')
            ->assertJsonPath('data.0.features', []);
    }

    public function test_authenticated_user_can_create_stub_payment(): void
    {
        config(['billing.provider' => 'stub']);
        $this->seedPlan();
        $user = $this->seedUser();

        $url = (string) $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year'])
            ->assertCreated()
            ->assertJsonPath('data.provider', 'stub')
            ->assertJsonPath('data.status', 'pending')
            ->json('data.checkout_url');

        $this->assertStringContainsString('/pay/stub/', $url);

        $this->assertDatabaseHas('payments', [
            'user_id' => $user->id,
            'provider' => 'stub',
            'status' => 'pending',
        ]);
    }

    public function test_stub_confirm_activates_subscription(): void
    {
        config(['billing.provider' => 'stub']);
        $plan = $this->seedPlan();
        $user = $this->seedUser();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year'])
            ->assertCreated();

        $uuid = $response->json('data.payment_uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/payments/{$uuid}/confirm-stub")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $this->assertDatabaseHas('payments', [
            'uuid' => $uuid,
            'status' => 'paid',
        ]);

        $this->assertDatabaseHas('user_subscriptions', [
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
        ]);

        $payload = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/subscription')
            ->assertOk()
            ->assertJsonPath('data.is_active', true)
            ->json('data');

        $this->assertIsInt($payload['days_left']);
        $this->assertSame($payload['days_left'], (int) $payload['days_left']);
        $this->assertGreaterThan(360, $payload['days_left']);
    }

    public function test_stub_insufficient_funds_does_not_activate_subscription(): void
    {
        config(['billing.provider' => 'stub']);
        $this->seedPlan();
        $user = $this->seedUser();

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year'])
            ->assertCreated()
            ->json('data.payment_uuid');

        $redirect = (string) $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/payments/{$uuid}/confirm-stub", ['outcome' => 'insufficient_funds'])
            ->assertOk()
            ->assertJsonPath('data.status', 'failed')
            ->json('data.redirect_url');

        $this->assertStringContainsString('payment=failed', $redirect);
        $this->assertStringContainsString('reason=insufficient_funds', $redirect);

        $this->assertDatabaseHas('payments', [
            'uuid' => $uuid,
            'status' => 'failed',
        ]);
        $this->assertSame(0, UserSubscription::query()->where('user_id', $user->id)->count());
    }

    public function test_stub_declined_card_does_not_activate_subscription(): void
    {
        config(['billing.provider' => 'stub']);
        $this->seedPlan();
        $user = $this->seedUser();

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year'])
            ->assertCreated()
            ->json('data.payment_uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/payments/{$uuid}/confirm-stub", ['outcome' => 'declined'])
            ->assertOk()
            ->assertJsonPath('data.status', 'failed');

        $this->assertDatabaseHas('payments', [
            'uuid' => $uuid,
            'status' => 'failed',
        ]);
        $this->assertSame(0, UserSubscription::query()->where('user_id', $user->id)->count());
    }

    public function test_confirm_stub_rejected_in_vtb_mode(): void
    {
        config([
            'billing.provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'test-user',
            'billing.vtb.password' => 'test-pass',
        ]);
        $this->seedPlan();
        $user = $this->seedUser();

        $payment = Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => 99000,
            'currency' => 'RUB',
            'status' => 'pending',
            'provider' => 'stub',
            'metadata' => ['payable_type' => 'subscription'],
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/payments/{$payment->uuid}/confirm-stub", ['outcome' => 'paid'])
            ->assertForbidden()
            ->assertJsonPath('code', 'vtb_required');
    }

    public function test_new_user_has_no_active_subscription(): void
    {
        $user = $this->seedUser();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/subscription')
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_unpaid_subscription_row_is_not_exposed(): void
    {
        $plan = $this->seedPlan();
        $user = $this->seedUser();
        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addYear(),
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/subscription')
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_public_plans_list_returns_every_active_plan(): void
    {
        SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'basic'],
            ['name' => 'Базовый', 'price_cents' => 0, 'period_days' => 30, 'is_active' => true, 'sort_order' => 0],
        );
        $this->seedPlan();
        SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'pro'],
            ['name' => 'Pro', 'price_cents' => 49900, 'period_days' => 30, 'is_active' => true, 'sort_order' => 15],
        );

        $slugs = $this->getJson('/api/v1/plans')
            ->assertOk()
            ->json('data');

        $this->assertContains('basic', array_column($slugs, 'slug'));
        $this->assertContains('year', array_column($slugs, 'slug'));
        $this->assertContains('pro', array_column($slugs, 'slug'));
    }

    public function test_vtb_checkout_returns_form_url(): void
    {
        config([
            'billing.provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'test-user',
            'billing.vtb.password' => 'test-pass',
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
        ]);

        Http::fake([
            'vtb.test/*' => Http::response([
                'orderId' => 'vtb-order-123',
                'formUrl' => 'https://vtb.test/pay/form',
            ]),
        ]);

        $this->seedPlan();
        $user = $this->seedUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year'])
            ->assertCreated()
            ->assertJsonPath('data.provider', 'vtb')
            ->assertJsonPath('data.checkout_url', 'https://vtb.test/pay/form');

        $this->assertDatabaseHas('payments', [
            'user_id' => $user->id,
            'provider' => 'vtb',
            'provider_payment_id' => 'vtb-order-123',
        ]);
    }

    public function test_vtb_webhook_marks_payment_paid(): void
    {
        config([
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'test-user',
            'billing.vtb.password' => 'test-pass',
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
        ]);

        Http::fake([
            'vtb.test/*' => Http::response(['orderStatus' => 2]),
        ]);

        $plan = $this->seedPlan();
        $user = $this->seedUser();

        $payment = Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => 99000,
            'currency' => 'RUB',
            'status' => 'pending',
            'provider' => 'vtb',
            'provider_payment_id' => 'vtb-order-456',
            'metadata' => ['plan_id' => $plan->id],
        ]);

        $this->postJson('/api/v1/payments/webhooks/vtb', [
            'mdOrder' => 'vtb-order-456',
            'operation' => 'deposited',
            'status' => 1,
        ])->assertOk();

        $payment->refresh();
        $this->assertSame('paid', $payment->status);
        $this->assertSame(1, UserSubscription::query()->where('user_id', $user->id)->count());
    }

    public function test_auto_prefers_vtb_when_configured(): void
    {
        config([
            'billing.provider' => 'auto',
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'vtb-user',
            'billing.vtb.password' => 'vtb-pass',
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
        ]);

        Http::fake([
            'vtb.test/*' => Http::response([
                'orderId' => 'vtb-auto',
                'formUrl' => 'https://vtb.test/form',
            ]),
        ]);

        $this->seedPlan();
        $user = $this->seedUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year'])
            ->assertJsonPath('data.provider', 'vtb');
    }
}
