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
        return SubscriptionPlan::query()->create([
            'slug' => $slug,
            'name' => 'Год',
            'price_cents' => 99000,
            'period_days' => 365,
            'is_active' => true,
            'sort_order' => 2,
        ]);
    }

    public function test_public_plans_list(): void
    {
        SubscriptionPlan::query()->create([
            'slug' => 'month',
            'name' => 'Месяц',
            'description' => 'Test',
            'price_cents' => 9900,
            'period_days' => 30,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $this->getJson('/api/v1/plans')
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'month');
    }

    public function test_authenticated_user_can_create_stub_payment(): void
    {
        config(['billing.provider' => 'stub']);
        $this->seedPlan();
        $user = $this->seedUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year'])
            ->assertCreated()
            ->assertJsonPath('data.provider', 'stub')
            ->assertJsonPath('data.status', 'pending');

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
            ->assertOk();

        $this->assertDatabaseHas('payments', [
            'uuid' => $uuid,
            'status' => 'paid',
        ]);

        $this->assertDatabaseHas('user_subscriptions', [
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
        ]);
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
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
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

    public function test_yookassa_checkout_returns_confirmation_url(): void
    {
        config([
            'billing.provider' => 'yookassa',
            'billing.yookassa.enabled' => true,
            'billing.yookassa.shop_id' => 'shop-id',
            'billing.yookassa.secret_key' => 'secret',
            'billing.yookassa.api_url' => 'https://yookassa.test/v3',
        ]);

        Http::fake([
            'yookassa.test/*' => Http::response([
                'id' => 'yk-payment-1',
                'status' => 'pending',
                'confirmation' => [
                    'type' => 'redirect',
                    'confirmation_url' => 'https://yookassa.test/pay/1',
                ],
            ]),
        ]);

        $this->seedPlan();
        $user = $this->seedUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year'])
            ->assertCreated()
            ->assertJsonPath('data.provider', 'yookassa')
            ->assertJsonPath('data.checkout_url', 'https://yookassa.test/pay/1');
    }

    public function test_auto_prefers_vtb_over_yookassa(): void
    {
        config([
            'billing.provider' => 'auto',
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'vtb-user',
            'billing.vtb.password' => 'vtb-pass',
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
            'billing.yookassa.enabled' => true,
            'billing.yookassa.shop_id' => 'shop',
            'billing.yookassa.secret_key' => 'secret',
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
