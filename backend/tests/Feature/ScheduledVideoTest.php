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
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class ScheduledVideoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makePublishedVideo(User $admin): Video
    {
        $category = VideoCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Авиация',
            'slug' => 'aviation-'.uniqid(),
            'sort_order' => 1,
        ]);

        $videoMedia = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'media/review_video/test.mp4',
            'filename' => 'test.mp4',
            'mime_type' => 'video/mp4',
            'size_bytes' => 1024,
            'uploaded_by' => $admin->id,
            'purpose' => 'review_video',
            'status' => MediaStatus::Ready,
        ]);

        return Video::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Scheduled review',
            'category_id' => $category->id,
            'video_media_id' => $videoMedia->id,
            'uploader_id' => $admin->id,
            'status' => 'published',
            'published_at' => now(),
            'tags' => [],
        ]);
    }

    public function test_admin_can_schedule_video_for_future_publication(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $video = $this->makePublishedVideo($admin);

        $future = now()->addDay()->format('Y-m-d H:i:s');

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/videos/'.$video->uuid.'/schedule', [
                'scheduled_at_local' => $future,
                'timezone' => 'Europe/Moscow',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'scheduled')
            ->assertJsonPath('data.scheduled_at', fn ($v) => is_string($v) && $v !== '');

        $this->assertDatabaseHas('videos', [
            'id' => $video->id,
            'status' => 'scheduled',
        ]);
    }

    public function test_publish_scheduled_command_publishes_due_videos(): void
    {
        Carbon::setTestNow('2026-08-02 12:00:00');

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $video = $this->makePublishedVideo($admin);
        $video->update([
            'status' => 'scheduled',
            'published_at' => null,
            'scheduled_at' => now()->subMinute(),
        ]);

        $this->artisan('videos:publish-scheduled')->assertSuccessful();

        $video->refresh();
        $this->assertSame('published', $video->status);
        $this->assertNotNull($video->published_at);
        $this->assertNull($video->scheduled_at);

        Carbon::setTestNow();
    }

    public function test_schedule_rejects_past_datetime(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $video = $this->makePublishedVideo($admin);

        $past = now()->subHour()->format('Y-m-d H:i:s');

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/videos/'.$video->uuid.'/schedule', [
                'scheduled_at_local' => $past,
                'timezone' => 'Europe/Moscow',
            ])
            ->assertStatus(422);
    }
}
