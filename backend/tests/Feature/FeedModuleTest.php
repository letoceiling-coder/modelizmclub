<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\MediaStatus;
use App\Enums\UserStatus;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FeedModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_publish_and_list_post_in_feed(): void
    {
        config(['feed.auto_publish' => true]);

        $category = PostCategory::create([
            'name' => 'Aviation',
            'slug' => 'aviation-feed',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);

        $draft = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'First build',
                'body' => 'My P-51 progress update.',
                'category_id' => $category->id,
                'hashtags' => ['p51'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', ContentStatus::Draft->value);

        $uuid = $draft->json('data.uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', ContentStatus::Published->value);

        $this->assertDatabaseHas('moderation_queue', [
            'moderatable_type' => Post::class,
            'status' => 'approved',
        ]);

        $this->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $uuid);
    }

    public function test_publish_without_auto_publish_goes_to_moderation_queue(): void
    {
        config(['feed.auto_publish' => false]);

        $category = PostCategory::create([
            'name' => 'Armor',
            'slug' => 'armor-feed',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Tiger review',
                'body' => 'Waiting for moderation.',
                'category_id' => $category->id,
            ])
            ->json('data.uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', ContentStatus::PendingModeration->value);

        $this->assertDatabaseHas('moderation_queue', [
            'moderatable_type' => Post::class,
            'status' => 'pending',
        ]);

        $this->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_comment_thread_respects_max_depth(): void
    {
        config(['feed.auto_publish' => true]);
        config(['feed.max_comment_depth' => 3]);

        $category = PostCategory::create([
            'name' => 'Ships',
            'slug' => 'ships-feed',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Bismarck',
                'body' => 'Build log.',
                'category_id' => $category->id,
            ])
            ->json('data.uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk();

        $rootUuid = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", ['body' => 'Level 0'])
            ->assertCreated()
            ->json('data.uuid');

        $level1 = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", [
                'body' => 'Level 1',
                'parent_uuid' => $rootUuid,
            ])
            ->assertCreated()
            ->json('data.uuid');

        $level2 = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", [
                'body' => 'Level 2',
                'parent_uuid' => $level1,
            ])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", [
                'body' => 'Too deep',
                'parent_uuid' => $level2,
            ])
            ->assertStatus(422);

        $this->getJson("/api/v1/comments/{$rootUuid}/thread")
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_media_upload_session_and_confirm(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $user = User::factory()->create(['status' => UserStatus::Active]);

        $session = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/upload-session', [
                'purpose' => 'post',
                'files' => [
                    ['name' => 'photo.jpg', 'size' => 1024, 'mime' => 'image/jpeg'],
                ],
            ])
            ->assertCreated()
            ->json('data');

        $mediaUuid = $session['uploads'][0]['media_uuid'];
        $path = $session['uploads'][0]['path'];

        Storage::disk('s3')->put($path, 'fake-image');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/confirm', [
                'session_uuid' => $session['session_uuid'],
                'media_uuids' => [$mediaUuid],
            ])
            ->assertOk()
            ->assertJsonPath('data.0.status', MediaStatus::Ready->value);

        $this->assertDatabaseHas('media', [
            'uuid' => $mediaUuid,
            'status' => MediaStatus::Ready->value,
        ]);
    }
}
