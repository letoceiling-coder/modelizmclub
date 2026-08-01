<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\UserStatus;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostModerationInteractionsTest extends TestCase
{
    use RefreshDatabase;

    private PostCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        config(['feed.auto_publish' => false]);

        $this->category = PostCategory::query()->create([
            'name' => 'Aviation',
            'slug' => 'aviation-interactions',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
    }

    private function publishPendingPost(User $author): string
    {
        $uuid = $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Pending post',
                'body' => 'Body text',
                'category_id' => $this->category->id,
            ])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', ContentStatus::PendingModeration->value);

        return $uuid;
    }

    public function test_stranger_cannot_interact_with_pending_moderation_post(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $viewer = User::factory()->create(['status' => UserStatus::Active]);
        $uuid = $this->publishPendingPost($author);

        // Post is hidden from non-viewers — direct API must not expose interactions.
        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/react")
            ->assertNotFound();

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/bookmark")
            ->assertNotFound();

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/repost")
            ->assertNotFound();

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", ['body' => 'Hello'])
            ->assertNotFound();
    }

    public function test_author_cannot_publicly_interact_with_own_pending_post(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $uuid = $this->publishPendingPost($author);

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/react")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post']);

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/bookmark")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post']);

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", ['body' => 'Hello'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post']);
    }

    public function test_author_can_view_and_delete_pending_post(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $uuid = $this->publishPendingPost($author);

        $this->actingAs($author, 'sanctum')
            ->getJson("/api/v1/posts/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.permissions.can_interact', false)
            ->assertJsonPath('data.permissions.can_delete', true);

        $this->actingAs($author, 'sanctum')
            ->deleteJson("/api/v1/posts/{$uuid}")
            ->assertOk();

        $this->assertSoftDeleted('posts', ['uuid' => $uuid]);
    }

    public function test_interactions_available_after_publish(): void
    {
        config(['feed.auto_publish' => true]);

        $author = User::factory()->create(['status' => UserStatus::Active]);
        $viewer = User::factory()->create(['status' => UserStatus::Active]);

        $uuid = $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Published post',
                'body' => 'Body text',
                'category_id' => $this->category->id,
            ])
            ->json('data.uuid');

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', ContentStatus::Published->value);

        $this->actingAs($viewer, 'sanctum')
            ->getJson("/api/v1/posts/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.permissions.can_interact', true);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/react")
            ->assertOk();

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/bookmark")
            ->assertOk()
            ->assertJsonPath('message', 'Добавлено в закладки.');

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", ['body' => 'Nice build'])
            ->assertCreated();
    }
}
