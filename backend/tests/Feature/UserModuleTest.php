<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class UserModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_profile_includes_friendship_status_for_viewer(): void
    {
        $viewer = User::factory()->create(['status' => UserStatus::Active]);
        $friend = User::factory()->create(['status' => UserStatus::Active]);

        UserProfile::create([
            'user_id' => $viewer->id,
            'display_name' => 'Viewer',
            'slug' => 'viewer-user',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);
        UserProfile::create([
            'user_id' => $friend->id,
            'display_name' => 'Friend User',
            'slug' => 'friend-user',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        \DB::table('user_friendships')->insert([
            ['user_id' => $viewer->id, 'friend_id' => $friend->id, 'created_at' => now()],
            ['user_id' => $friend->id, 'friend_id' => $viewer->id, 'created_at' => now()],
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/users/friend-user')
            ->assertOk()
            ->assertJsonPath('data.is_friend', true)
            ->assertJsonPath('data.uuid', $friend->uuid);
    }

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

    /**
     * «Выбрали два направления — сохранилось одно» (приёмка 17.09).
     *
     * Цепочка сервера целиком: запрос с двумя id → две строки в
     * user_interests → оба в ответе и в /auth/me, откуда профиль берёт их
     * после перезагрузки. Тест проходил и до правки: массив терялся не здесь,
     * а в форме (ProfileView: выбранное в списке, но не добавленное «+»
     * направление в запрос не попадало; на проде 17.09 PUT ушёл с
     * category_ids [1] при выбранных «Авиация» и «Корабли»).
     */
    public function test_two_interests_survive_save_and_reload(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create(['user_id' => $user->id, 'display_name' => 'U', 'slug' => 'u2']);

        $ids = collect(['aviation', 'ships'])->map(fn (string $slug, int $i) => PostCategory::create([
            'name' => ucfirst($slug),
            'slug' => $slug,
            'sort_order' => $i,
            'is_active' => true,
            'depth' => 0,
            'path' => $slug,
        ])->id)->all();

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/v1/users/me/interests', ['category_ids' => $ids])
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->assertSame(2, DB::table('user_interests')->where('user_id', $user->id)->count());

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonCount(2, 'data.interests');
    }
}
