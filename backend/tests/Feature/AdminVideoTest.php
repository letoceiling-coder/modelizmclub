<?php

namespace Tests\Feature;

use App\Enums\MediaStatus;
use App\Enums\UserRole;
use App\Models\Media;
use App\Models\User;
use App\Models\Video;
use App\Models\VideoCategory;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminVideoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeVideo(User $uploader, string $status = 'processing'): Video
    {
        $category = VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Танки',
            'slug' => 'tanks-'.uniqid(),
            'sort_order' => 1,
        ]);

        $videoMedia = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'media/review_video/test.mp4',
            'filename' => 'test.mp4',
            'mime_type' => 'video/mp4',
            'size_bytes' => 1024,
            'uploaded_by' => $uploader->id,
            'purpose' => 'review_video',
            'status' => MediaStatus::Ready,
        ]);

        return Video::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Admin review',
            'category_id' => $category->id,
            'video_media_id' => $videoMedia->id,
            'uploader_id' => $uploader->id,
            'status' => $status,
            'published_at' => $status === 'published' ? now() : null,
            'tags' => [],
        ]);
    }

    public function test_admin_can_list_and_filter_videos(): void
    {
        $uploader = User::factory()->create();
        $published = $this->makeVideo($uploader, 'published');
        $this->makeVideo($uploader, 'processing');

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;

        $this->getJson('/api/v1/admin/videos?status=published', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $published->uuid)
            ->assertJsonCount(1, 'data');
    }

    public function test_admin_can_update_featured_and_delete_video(): void
    {
        $uploader = User::factory()->create();
        $video = $this->makeVideo($uploader, 'published');

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->patchJson('/api/v1/admin/videos/'.$video->uuid, [
            'is_featured' => true,
        ], $headers)->assertOk()
            ->assertJsonPath('data.is_featured', true);

        $this->deleteJson('/api/v1/admin/videos/'.$video->uuid, [], $headers)
            ->assertOk();

        $this->assertDatabaseMissing('videos', ['id' => $video->id]);
    }

    public function test_admin_can_update_content_fields(): void
    {
        $uploader = User::factory()->create();
        $video = $this->makeVideo($uploader, 'published');
        $newCategory = VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Самолёты',
            'slug' => 'planes-'.uniqid(),
            'sort_order' => 2,
        ]);

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->patchJson('/api/v1/admin/videos/'.$video->uuid, [
            'title' => 'Updated title',
            'description' => 'New description',
            'category_id' => $newCategory->uuid,
            'tags' => ['tag1', 'tag2'],
        ], $headers)->assertOk()
            ->assertJsonPath('data.title', 'Updated title')
            ->assertJsonPath('data.description', 'New description');

        $video->refresh();
        $this->assertSame('Updated title', $video->title);
        $this->assertSame('New description', $video->description);
        $this->assertSame($newCategory->id, $video->category_id);
        $this->assertSame(['tag1', 'tag2'], $video->tags);
    }

    public function test_moderator_cannot_access_admin_videos(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);
        $token = $moderator->createToken('api')->plainTextToken;

        $this->getJson('/api/v1/admin/videos', ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }
}
