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

        // The author keeps seeing their own post while it's on moderation — it
        // must not vanish from their feed on refresh.
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $uuid);

        // Guest (unauthenticated) must not see posts pending moderation.
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        // A different user does not see a post that is still on moderation.
        $other = User::factory()->create(['status' => UserStatus::Active]);
        $this->actingAs($other, 'sanctum')
            ->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_feed_auto_publish_setting_overrides_config(): void
    {
        // Config says moderation ON, but the admin SystemSetting flips it to auto-publish.
        config(['feed.auto_publish' => false]);
        \App\Models\SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.feed_auto_publish'],
            ['value' => ['enabled' => true], 'group' => 'feed'],
        );

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
                'title' => 'Bismarck build',
                'body' => 'Auto-published via admin setting.',
                'category_id' => $category->id,
            ])
            ->json('data.uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', ContentStatus::Published->value);

        // Now disable via setting; even though config still false, moderation applies.
        \App\Models\SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.feed_auto_publish'],
            ['value' => ['enabled' => false], 'group' => 'feed'],
        );

        $secondUuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Yamato build',
                'body' => 'Should wait for moderation.',
                'category_id' => $category->id,
            ])
            ->json('data.uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$secondUuid}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', ContentStatus::PendingModeration->value);
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

        $list = $this->getJson("/api/v1/posts/{$uuid}/comments")
            ->assertOk()
            ->assertJsonCount(1, 'data');
        $this->assertCount(2, $list->json('data.0.replies'));
        $this->assertSame($level1, $list->json('data.0.replies.0.uuid'));
        $this->assertSame($level2, $list->json('data.0.replies.1.uuid'));
    }

    public function test_user_can_delete_own_comment_and_nested_replies(): void
    {
        config(['feed.auto_publish' => true]);
        config(['feed.max_comment_depth' => 5]);

        $category = PostCategory::create([
            'name' => 'Ships',
            'slug' => 'ships-delete-comment',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $stranger = User::factory()->create(['status' => UserStatus::Active]);

        $uuid = $this->actingAs($owner, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Bismarck',
                'body' => 'Build log.',
                'category_id' => $category->id,
            ])
            ->json('data.uuid');

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk();

        $rootUuid = $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", ['body' => 'Root'])
            ->assertCreated()
            ->json('data.uuid');

        $replyUuid = $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", [
                'body' => 'Reply',
                'parent_uuid' => $rootUuid,
            ])
            ->assertCreated()
            ->json('data.uuid');

        $childUuid = $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", [
                'body' => 'Nested',
                'parent_uuid' => $replyUuid,
            ])
            ->assertCreated()
            ->json('data.uuid');

        $this->assertDatabaseHas('posts', ['uuid' => $uuid, 'comments_count' => 3]);

        $this->actingAs($stranger, 'sanctum')
            ->deleteJson("/api/v1/comments/{$rootUuid}")
            ->assertForbidden(); // CommentPolicy::delete — author or moderator

        $this->assertDatabaseHas('comments', ['uuid' => $rootUuid, 'deleted_at' => null]);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/v1/comments/{$replyUuid}")
            ->assertOk();

        $this->assertSoftDeleted('comments', ['uuid' => $replyUuid]);
        $this->assertDatabaseHas('comments', ['uuid' => $childUuid, 'deleted_at' => null]);
        $this->assertDatabaseHas('posts', ['uuid' => $uuid, 'comments_count' => 2]);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/v1/comments/{$rootUuid}")
            ->assertOk();

        $this->assertSoftDeleted('comments', ['uuid' => $rootUuid]);
        $this->assertSoftDeleted('comments', ['uuid' => $childUuid]);
        $this->assertDatabaseHas('posts', ['uuid' => $uuid, 'comments_count' => 0]);

        $this->getJson("/api/v1/posts/{$uuid}/comments")
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_user_can_delete_own_published_post(): void
    {
        config(['feed.auto_publish' => true]);

        $category = PostCategory::create([
            'name' => 'Aviation',
            'slug' => 'aviation-delete',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Delete me',
                'body' => 'Temporary post.',
                'category_id' => $category->id,
            ])
            ->json('data.uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk();

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/v1/posts/{$uuid}")
            ->assertOk()
            ->assertJsonPath('message', 'Публикация удалена.');

        $this->assertSoftDeleted('posts', ['uuid' => $uuid]);
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

    public function test_post_can_attach_pending_video_before_confirm(): void
    {
        config(['feed.auto_publish' => true]);
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $category = PostCategory::create([
            'name' => 'Aviation',
            'slug' => 'aviation-pending-video',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);
        $stranger = User::factory()->create(['status' => UserStatus::Active]);

        $session = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/upload-session', [
                'purpose' => 'post_video',
                'files' => [
                    ['name' => 'clip.mp4', 'size' => 2048, 'mime' => 'video/mp4'],
                ],
            ])
            ->assertCreated()
            ->json('data');

        $mediaUuid = $session['uploads'][0]['media_uuid'];
        $path = $session['uploads'][0]['path'];

        $this->actingAs($stranger, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Not mine',
                'body' => 'Should fail.',
                'category_id' => $category->id,
                'media_ids' => [$mediaUuid],
            ])
            ->assertStatus(422);

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Maiden flight',
                'body' => 'Clip from the field.',
                'category_id' => $category->id,
                'media_ids' => [$mediaUuid],
            ])
            ->assertCreated()
            ->assertJsonPath('data.media.0.type', 'video')
            ->assertJsonPath('data.media.0.media.status', MediaStatus::Pending->value)
            ->assertJsonPath('data.media.0.media.url', null)
            ->json('data.uuid');

        $photoSession = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/upload-session', [
                'purpose' => 'post',
                'files' => [
                    ['name' => 'photo.jpg', 'size' => 1024, 'mime' => 'image/jpeg'],
                ],
            ])
            ->assertCreated()
            ->json('data');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Photo still uploading',
                'body' => 'Should require a ready image.',
                'category_id' => $category->id,
                'media_ids' => [$photoSession['uploads'][0]['media_uuid']],
            ])
            ->assertStatus(422);

        Storage::disk('s3')->put($path, 'fake-video');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/confirm', [
                'session_uuid' => $session['session_uuid'],
                'media_uuids' => [$mediaUuid],
            ])
            ->assertOk()
            ->assertJsonPath('data.0.status', MediaStatus::Ready->value);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/posts/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.media.0.media.status', MediaStatus::Ready->value);

        $this->assertNotNull(
            $this->actingAs($user, 'sanctum')->getJson("/api/v1/posts/{$uuid}")->json('data.media.0.media.url'),
        );
    }

    public function test_owner_can_fail_pending_media_upload(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $user = User::factory()->create(['status' => UserStatus::Active]);
        $stranger = User::factory()->create(['status' => UserStatus::Active]);

        $session = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/upload-session', [
                'purpose' => 'post_video',
                'files' => [
                    ['name' => 'clip.mp4', 'size' => 2048, 'mime' => 'video/mp4'],
                ],
            ])
            ->assertCreated()
            ->json('data');

        $mediaUuid = $session['uploads'][0]['media_uuid'];

        $this->actingAs($stranger, 'sanctum')
            ->postJson('/api/v1/media/fail', ['media_uuids' => [$mediaUuid]])
            ->assertStatus(422);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/fail', ['media_uuids' => [$mediaUuid]])
            ->assertOk();

        $this->assertDatabaseHas('media', [
            'uuid' => $mediaUuid,
            'status' => MediaStatus::Failed->value,
        ]);
    }

    public function test_comment_can_include_a_photo(): void
    {
        config(['feed.auto_publish' => true]);
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $category = PostCategory::create([
            'name' => 'Aviation',
            'slug' => 'aviation-comment-photo',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Build',
                'body' => 'Progress.',
                'category_id' => $category->id,
            ])
            ->json('data.uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk();

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", ['body' => ''])
            ->assertStatus(422);

        $photo = \App\Models\Media::query()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'disk' => 's3',
            'path' => 'media/comment/2026/09/shot.jpg',
            'filename' => 'shot.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 2048,
            'uploaded_by' => $user->id,
            'status' => MediaStatus::Ready,
        ]);

        $comment = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", [
                'body' => '',
                'media_ids' => [$photo->uuid],
            ])
            ->assertCreated()
            ->assertJsonPath('data.media.0.uuid', $photo->uuid)
            ->json('data');

        $this->assertDatabaseHas('comment_media', [
            'media_id' => $photo->id,
        ]);

        $list = $this->getJson("/api/v1/posts/{$uuid}/comments")->assertOk();
        $this->assertSame($photo->uuid, $list->json('data.0.media.0.uuid'));
        $this->assertNotEmpty($comment['uuid']);
    }

    public function test_repost_keeps_original_and_stores_share_comment(): void
    {
        config(['feed.auto_publish' => true]);

        $category = PostCategory::create([
            'name' => 'Aviation',
            'slug' => 'aviation-repost-share',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $author = User::factory()->create(['status' => UserStatus::Active]);
        $viewer = User::factory()->create(['status' => UserStatus::Active]);

        $uuid = $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'P-51 build',
                'body' => 'Progress on the fuselage.',
                'category_id' => $category->id,
            ])
            ->json('data.uuid');

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk();

        $share = $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/repost", ['body' => 'Крутой билд'])
            ->assertCreated()
            ->assertJsonPath('data.title', '')
            ->assertJsonPath('data.body', 'Крутой билд')
            ->assertJsonPath('data.repost_of.uuid', $uuid)
            ->assertJsonPath('data.repost_of.title', 'P-51 build')
            ->assertJsonPath('data.repost_of.body', 'Progress on the fuselage.')
            ->assertJsonPath('data.repost_of.viewer.reposted', true);

        $this->assertSame([], $share->json('data.media'));
        $this->assertNotSame($uuid, $share->json('data.uuid'));

        $this->actingAs($viewer, 'sanctum')
            ->getJson("/api/v1/posts/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.viewer.reposted', true)
            ->assertJsonPath('data.stats.reposts', 1)
            ->assertJsonPath('data.body', 'Progress on the fuselage.');

        $profile = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/feed?author_id='.$viewer->id)
            ->assertOk();

        $this->assertSame($share->json('data.uuid'), $profile->json('data.0.uuid'));
        $this->assertSame('Крутой билд', $profile->json('data.0.body'));
        $this->assertSame($uuid, $profile->json('data.0.repost_of.uuid'));
        $this->assertSame('Progress on the fuselage.', $profile->json('data.0.repost_of.body'));

        $this->actingAs($viewer, 'sanctum')
            ->deleteJson("/api/v1/posts/{$uuid}/repost")
            ->assertOk()
            ->assertJsonPath('data.viewer.reposted', false)
            ->assertJsonPath('data.stats.reposts', 0);

        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/feed?author_id='.$viewer->id)
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
