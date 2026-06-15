<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_profile_by_slug(): void
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'role' => UserRole::User,
        ]);

        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Model Builder',
            'slug' => 'model-builder',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        $response = $this->getJson('/api/v1/users/model-builder');

        $response->assertOk()
            ->assertJsonPath('data.slug', 'model-builder')
            ->assertJsonPath('data.display_name', 'Model Builder');
    }

    public function test_authenticated_user_can_update_profile(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Old Name',
            'slug' => 'old-name',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->patchJson('/api/v1/users/me', [
                'display_name' => 'New Name',
                'bio' => 'Scale models fan',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.display_name', 'New Name')
            ->assertJsonPath('data.bio', 'Scale models fan');
    }

    public function test_user_can_follow_and_unfollow(): void
    {
        $follower = User::factory()->create(['status' => UserStatus::Active]);
        $target = User::factory()->create(['status' => UserStatus::Active]);

        UserProfile::create(['user_id' => $follower->id, 'display_name' => 'A', 'slug' => 'a']);
        UserProfile::create(['user_id' => $target->id, 'display_name' => 'B', 'slug' => 'b']);

        $this->actingAs($follower, 'sanctum')
            ->postJson("/api/v1/users/{$target->id}/follow")
            ->assertOk();

        $this->assertDatabaseHas('user_follows', [
            'follower_id' => $follower->id,
            'following_id' => $target->id,
        ]);

        $this->actingAs($follower, 'sanctum')
            ->deleteJson("/api/v1/users/{$target->id}/follow")
            ->assertOk();

        $this->assertDatabaseMissing('user_follows', [
            'follower_id' => $follower->id,
            'following_id' => $target->id,
        ]);
    }

    public function test_user_can_sync_interests(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create(['user_id' => $user->id, 'display_name' => 'U', 'slug' => 'u']);

        $category = PostCategory::create([
            'name' => 'Aviation',
            'slug' => 'aviation',
            'sort_order' => 1,
            'is_active' => true,
            'depth' => 0,
            'path' => 'aviation',
        ]);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/v1/users/me/interests', ['category_ids' => [$category->id]])
            ->assertOk()
            ->assertJsonPath('data.0.slug', 'aviation');
    }
}
