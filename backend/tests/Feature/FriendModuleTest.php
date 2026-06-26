<?php

namespace Tests\Feature;

use App\Enums\FriendRequestStatus;
use App\Enums\UserStatus;
use App\Models\FriendRequest;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FriendModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_send_accept_and_remove_friend(): void
    {
        $a = $this->userWithProfile('alice', 'alice');
        $b = $this->userWithProfile('bob', 'bob');

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/users/{$b->id}/friend-request")
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $requestId = FriendRequest::query()->value('id');

        $this->actingAs($b, 'sanctum')
            ->postJson("/api/v1/friend-requests/{$requestId}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->assertDatabaseHas('user_friendships', [
            'user_id' => $a->id,
            'friend_id' => $b->id,
        ]);
        $this->assertDatabaseHas('user_friendships', [
            'user_id' => $b->id,
            'friend_id' => $a->id,
        ]);

        $this->actingAs($a, 'sanctum')
            ->getJson('/api/v1/users/me/friends')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($a, 'sanctum')
            ->deleteJson("/api/v1/users/me/friends/{$b->id}")
            ->assertOk();

        $this->assertDatabaseMissing('user_friendships', [
            'user_id' => $a->id,
            'friend_id' => $b->id,
        ]);
    }

    public function test_cross_request_auto_accepts(): void
    {
        $a = $this->userWithProfile('carol', 'carol');
        $b = $this->userWithProfile('dave', 'dave');

        FriendRequest::query()->create([
            'from_user_id' => $b->id,
            'to_user_id' => $a->id,
            'status' => FriendRequestStatus::Pending,
        ]);

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/users/{$b->id}/friend-request")
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->assertDatabaseHas('user_friendships', [
            'user_id' => $a->id,
            'friend_id' => $b->id,
        ]);
    }

    public function test_incoming_requests_list(): void
    {
        $a = $this->userWithProfile('erin', 'erin');
        $b = $this->userWithProfile('frank', 'frank');

        FriendRequest::query()->create([
            'from_user_id' => $a->id,
            'to_user_id' => $b->id,
            'status' => FriendRequestStatus::Pending,
        ]);

        $this->actingAs($b, 'sanctum')
            ->getJson('/api/v1/users/me/friend-requests')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    private function userWithProfile(string $name, string $slug): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active, 'name' => $name]);

        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => $name,
            'slug' => $slug,
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }
}
