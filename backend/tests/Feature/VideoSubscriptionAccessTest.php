<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Access model per spec v4.0 §1.3: viewing reviews is open to everyone, while
 * publishing content / interacting requires an active subscription.
 */
class VideoSubscriptionAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function seedSubscriber(): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active, 'email_verified_at' => now(), 'phone_verified_at' => now()]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Subscriber',
            'slug' => 'subscriber-'.uniqid(),
        ]);
        $plan = SubscriptionPlan::query()->create([
            'slug' => 'month-'.uniqid(),
            'name' => 'Месяц',
            'price_cents' => 9900,
            'period_days' => 30,
            'sort_order' => 1,
            'is_active' => true,
        ]);
        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addMonth(),
        ]);

        return $user;
    }

    public function test_guest_can_list_videos(): void
    {
        $this->getJson('/api/v1/videos')->assertOk();
    }

    public function test_user_without_subscription_can_list_videos(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/videos')
            ->assertOk();
    }

    public function test_user_without_subscription_cannot_publish_video(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active, 'email_verified_at' => now(), 'phone_verified_at' => now()]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'NoSub',
            'slug' => 'nosub-'.uniqid(),
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/videos', [])
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');
    }

    public function test_subscriber_passes_publish_gate(): void
    {
        $user = $this->seedSubscriber();

        // Passes the subscription gate; fails validation for the empty body
        // (422) rather than being blocked by the middleware (403).
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/videos', [])
            ->assertStatus(422);
    }
}
