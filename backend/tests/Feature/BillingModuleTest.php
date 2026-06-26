<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BillingModuleTest extends TestCase
{
    use RefreshDatabase;

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
        SubscriptionPlan::query()->create([
            'slug' => 'year',
            'name' => 'Год',
            'price_cents' => 99000,
            'period_days' => 365,
            'is_active' => true,
            'sort_order' => 2,
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Payer',
            'slug' => 'payer',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

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
}
