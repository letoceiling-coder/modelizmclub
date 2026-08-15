<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

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
        $user = User::factory()->create(['status' => UserStatus::Active]);
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

    public function test_guest_cannot_list_videos(): void
    {
        $this->getJson('/api/v1/videos')
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');
    }

    public function test_user_without_subscription_cannot_list_videos(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/videos')
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');
    }

    public function test_subscriber_can_list_videos(): void
    {
        $user = $this->seedSubscriber();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/videos')
            ->assertOk();
    }

    public function test_moderator_can_list_videos_without_subscription(): void
    {
        $moderator = User::factory()->create([
            'status' => UserStatus::Active,
            'role' => UserRole::Moderator,
        ]);

        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/videos')
            ->assertOk();
    }
}
