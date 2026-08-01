<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PostModerationInteractionsTest extends TestCase
{
    use RefreshDatabase;

    private PostCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->category = PostCategory::query()->create([
            'name' => 'Aviation',
            'slug' => 'aviation-interactions',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
    }

    private function pendingPost(User $author): Post
    {
        return Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'category_id' => $this->category->id,
            'title' => 'Pending post',
            'body' => 'Body text',
            'status' => ContentStatus::PendingModeration,
        ]);
    }

    public function test_public_interactions_blocked_on_pending_moderation_post(): void
    {
        $author = User::factory()->create();
        $viewer = User::factory()->create();
        $post = $this->pendingPost($author);
        $token = $viewer->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->postJson('/api/v1/posts/'.$post->uuid.'/react', [], $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post']);

        $this->postJson('/api/v1/posts/'.$post->uuid.'/bookmark', [], $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post']);

        $this->postJson('/api/v1/posts/'.$post->uuid.'/repost', [], $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post']);

        $this->postJson('/api/v1/posts/'.$post->uuid.'/comments', ['body' => 'Hello'], $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post']);
    }

    public function test_author_can_view_and_delete_pending_post(): void
    {
        $author = User::factory()->create();
        $post = $this->pendingPost($author);
        $token = $author->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->getJson('/api/v1/posts/'.$post->uuid, $headers)
            ->assertOk()
            ->assertJsonPath('data.permissions.can_interact', false)
            ->assertJsonPath('data.permissions.can_delete', true);

        $this->deleteJson('/api/v1/posts/'.$post->uuid, [], $headers)
            ->assertOk();
    }

    public function test_interactions_available_after_publish(): void
    {
        $author = User::factory()->create();
        $viewer = User::factory()->create();
        $post = Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'category_id' => $this->category->id,
            'title' => 'Published post',
            'body' => 'Body text',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);

        $token = $viewer->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->getJson('/api/v1/posts/'.$post->uuid, $headers)
            ->assertOk()
            ->assertJsonPath('data.permissions.can_interact', true);

        $this->postJson('/api/v1/posts/'.$post->uuid.'/react', [], $headers)
            ->assertOk();

        $this->postJson('/api/v1/posts/'.$post->uuid.'/bookmark', [], $headers)
            ->assertOk()
            ->assertJsonPath('message', 'Добавлено в закладки.');

        $this->postJson('/api/v1/posts/'.$post->uuid.'/comments', ['body' => 'Nice build'], $headers)
            ->assertCreated();
    }
}
