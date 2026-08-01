<?php

namespace Tests\Feature;

use App\Enums\MediaStatus;
use App\Enums\UserRole;
use App\Models\Media;
use App\Models\ModerationQueue;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\Video;
use App\Models\VideoCategory;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class VideoUploadModerationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_review_video_upload_session_accepts_purpose(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/upload-session', [
                'purpose' => 'review_video',
                'files' => [
                    ['name' => 'review.mp4', 'size' => 5_242_880, 'mime' => 'video/mp4'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.uploads.0.media_uuid', fn ($v) => is_string($v) && $v !== '');
    }

    public function test_admin_can_create_video_without_poster(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $admin = User::factory()->create(['role' => UserRole::Admin]);

        $category = VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Суда',
            'slug' => 'ships-'.uniqid(),
            'sort_order' => 1,
        ]);

        $videoMedia = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'media/review_video/2026/07/clip.mp4',
            'filename' => 'clip.mp4',
            'mime_type' => 'video/mp4',
            'size_bytes' => 5_242_880,
            'uploaded_by' => $admin->id,
            'purpose' => 'review_video',
            'status' => MediaStatus::Ready,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/videos', [
                'title' => 'Обзор 1',
                'description' => 'Без обложки',
                'category_id' => $category->uuid,
                'video_media_id' => $videoMedia->uuid,
                'is_featured' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'published');

        $this->assertDatabaseHas('videos', [
            'title' => 'Обзор 1',
            'poster_media_id' => null,
            'status' => 'published',
        ]);
    }

    public function test_moderator_can_approve_video(): void
    {
        $uploader = User::factory()->create();
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);

        $category = VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Обзоры',
            'slug' => 'reviews-'.uniqid(),
            'sort_order' => 1,
        ]);

        $poster = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'review_video/'.$uploader->id.'/poster.jpg',
            'filename' => 'poster.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
            'uploaded_by' => $uploader->id,
            'status' => MediaStatus::Ready,
        ]);

        $videoMedia = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'review_video/'.$uploader->id.'/clip.mp4',
            'filename' => 'clip.mp4',
            'mime_type' => 'video/mp4',
            'size_bytes' => 5_242_880,
            'uploaded_by' => $uploader->id,
            'status' => MediaStatus::Ready,
        ]);

        $video = Video::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Test review',
            'category_id' => $category->id,
            'poster_media_id' => $poster->id,
            'video_media_id' => $videoMedia->id,
            'uploader_id' => $uploader->id,
            'status' => 'processing',
            'tags' => [],
        ]);

        ModerationQueue::query()->create([
            'moderatable_type' => Video::class,
            'moderatable_id' => $video->id,
            'queue' => 'videos',
            'status' => 'pending',
        ]);

        $token = $moderator->createToken('api')->plainTextToken;

        $this->postJson(
            '/api/v1/admin/moderation/videos/'.$video->uuid.'/approve',
            [],
            ['Authorization' => 'Bearer '.$token],
        )->assertOk();

        $this->assertDatabaseHas('videos', [
            'id' => $video->id,
            'status' => 'published',
        ]);
    }

    public function test_guest_can_view_published_video_detail_with_uploader(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $uploader = User::factory()->create();
        UserProfile::query()->create([
            'user_id' => $uploader->id,
            'display_name' => 'Review Author',
            'slug' => 'review-author-'.uniqid(),
        ]);

        $category = VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Авиация',
            'slug' => 'aviation-'.uniqid(),
            'sort_order' => 1,
        ]);

        $videoMedia = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'media/review_video/2026/07/clip.mp4',
            'filename' => 'clip.mp4',
            'mime_type' => 'video/mp4',
            'size_bytes' => 5_242_880,
            'uploaded_by' => $uploader->id,
            'purpose' => 'review_video',
            'status' => MediaStatus::Ready,
        ]);

        $video = Video::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Обзор для гостя',
            'description' => 'Описание',
            'category_id' => $category->id,
            'video_media_id' => $videoMedia->id,
            'uploader_id' => $uploader->id,
            'status' => 'published',
            'published_at' => now(),
            'tags' => ['test'],
            'views_count' => 3,
        ]);

        $this->getJson('/api/v1/videos/'.$video->uuid)
            ->assertOk()
            ->assertJsonPath('data.uuid', $video->uuid)
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.video_url', fn ($url) => is_string($url) && $url !== '')
            ->assertJsonPath('data.uploader.uuid', $uploader->uuid)
            ->assertJsonPath('data.uploader.display_name', fn ($name) => is_string($name) && $name !== '');
    }
}
