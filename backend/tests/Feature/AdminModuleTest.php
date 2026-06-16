<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminModuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_moderation_queue_requires_moderator_role(): void
    {
        $user = User::factory()->create(['role' => UserRole::User]);
        $token = $user->createToken('api')->plainTextToken;

        $this->getJson('/api/v1/admin/moderation/queue', ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }

    public function test_moderator_can_list_moderation_queue(): void
    {
        $category = PostCategory::query()->create([
            'name' => 'Aviation',
            'slug' => 'aviation-admin',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $author = User::factory()->create();
        $post = Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'category_id' => $category->id,
            'title' => 'Pending post',
            'body' => 'Body',
            'status' => ContentStatus::PendingModeration,
        ]);

        ModerationQueue::query()->create([
            'moderatable_type' => Post::class,
            'moderatable_id' => $post->id,
            'queue' => 'posts',
            'status' => 'pending',
        ]);

        $token = $moderator->createToken('api')->plainTextToken;

        $this->getJson('/api/v1/admin/moderation/queue', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('data.0.queue', 'posts');
    }

    public function test_moderator_can_approve_post(): void
    {
        $category = PostCategory::query()->create([
            'name' => 'Armor',
            'slug' => 'armor-admin',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $post = Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'category_id' => $category->id,
            'title' => 'Approve me',
            'body' => 'Body',
            'status' => ContentStatus::PendingModeration,
        ]);

        ModerationQueue::query()->create([
            'moderatable_type' => Post::class,
            'moderatable_id' => $post->id,
            'queue' => 'posts',
            'status' => 'pending',
        ]);

        $token = $moderator->createToken('api')->plainTextToken;

        $this->postJson(
            '/api/v1/admin/moderation/posts/'.$post->uuid.'/approve',
            [],
            ['Authorization' => 'Bearer '.$token],
        )->assertOk();

        $this->assertDatabaseHas('posts', [
            'id' => $post->id,
            'status' => ContentStatus::Published->value,
        ]);
    }

    public function test_admin_dashboard_requires_admin_role(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $token = $moderator->createToken('api')->plainTextToken;

        $this->getJson('/api/v1/admin/dashboard', ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }

    public function test_admin_can_access_dashboard(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;

        $this->getJson('/api/v1/admin/dashboard', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonStructure(['data' => ['users_total', 'moderation_pending']]);
    }
}
