<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\MediaStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Media;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\Video;
use App\Models\VideoCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Feed\Services\PostService;
use Tests\TestCase;

/**
 * Отложенные публикации: отказ виден в логе, удалённая запись не висит
 * отложенной, сломанное видео не останавливает остальные.
 */
class ScheduledPublishHygieneTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_scheduled_post_clears_its_schedule(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $post = $this->makePost($author, ContentStatus::Scheduled, now()->addDay());

        app(PostService::class)->delete($post, $author);

        $row = Post::withTrashed()->findOrFail($post->id);
        $this->assertNotNull($row->deleted_at);
        $this->assertSame(ContentStatus::Draft, $row->status);
        $this->assertNull($row->scheduled_at);
    }

    public function test_deleting_published_post_keeps_its_status(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $post = $this->makePost($author, ContentStatus::Published, null);

        $post->delete();

        $this->assertSame(ContentStatus::Published, Post::withTrashed()->findOrFail($post->id)->status);
    }

    public function test_failed_scheduled_post_is_logged_once_per_hour_and_stays_scheduled(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $post = $this->makePost($author, ContentStatus::Scheduled, now()->subMinute());

        $this->mock(PostService::class)->makePartial()
            ->shouldReceive('publish')->andThrow(new \RuntimeException('права автора отозваны'));

        Log::spy();
        $this->artisan('posts:publish-scheduled')->assertSuccessful();
        $this->artisan('posts:publish-scheduled')->assertSuccessful();

        Log::shouldHaveReceived('warning')->once()->withArgs(
            fn (string $message, array $context) => str_contains($message, "post #{$post->id}")
                && $context['message'] === 'права автора отозваны',
        );
        $this->assertSame(ContentStatus::Scheduled, $post->fresh()->status);

        // Через час — снова в лог.
        Carbon::setTestNow(now()->addHour()->addMinute());
        $this->artisan('posts:publish-scheduled')->assertSuccessful();
        Log::shouldHaveReceived('warning')->twice();
        Carbon::setTestNow();
    }

    public function test_one_broken_video_does_not_stop_the_others_and_is_logged(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Owner]);
        $broken = $this->scheduledVideo($admin);
        $fine = $this->scheduledVideo($admin);

        Video::updating(function (Video $video) use ($broken): void {
            if ($video->id === $broken->id) {
                throw new \RuntimeException('битая строка');
            }
        });

        Log::spy();
        $this->artisan('videos:publish-scheduled')->assertSuccessful();

        $this->assertSame('published', $fine->fresh()->status);
        $this->assertSame('scheduled', $broken->fresh()->status);
        Log::shouldHaveReceived('warning')->once()->withArgs(
            fn (string $message) => str_contains($message, "video #{$broken->id}"),
        );
    }

    private function makePost(User $author, ContentStatus $status, ?Carbon $scheduledAt): Post
    {
        $category = PostCategory::query()->create([
            'name' => 'Стена', 'slug' => 'wall-'.Str::random(6), 'sort_order' => 10, 'depth' => 0, 'path' => 'wall', 'is_active' => true,
        ]);

        return Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'category_id' => $category->id,
            'title' => 'Запись',
            'body' => 'Текст',
            'status' => $status,
            'scheduled_at' => $scheduledAt,
            'published_at' => $status === ContentStatus::Published ? now() : null,
        ]);
    }

    private function scheduledVideo(User $admin): Video
    {
        $category = VideoCategory::query()->create(['uuid' => (string) Str::uuid(), 'title' => 'Обзоры', 'slug' => 'r-'.Str::random(6), 'sort_order' => 1]);
        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(), 'uploaded_by' => $admin->id, 'disk' => 'local',
            'path' => 'media/review_video/'.Str::random(6).'.mp4', 'filename' => 'v.mp4', 'mime_type' => 'video/mp4',
            'size_bytes' => 1024, 'purpose' => 'review_video', 'status' => MediaStatus::Ready,
        ]);

        return Video::query()->create([
            'uuid' => (string) Str::uuid(), 'title' => 'Обзор', 'category_id' => $category->id,
            'video_media_id' => $media->id, 'uploader_id' => $admin->id, 'status' => 'scheduled',
            'scheduled_at' => now()->subMinute(), 'tags' => [],
        ]);
    }
}
