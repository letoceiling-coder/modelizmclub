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
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Отложенная публикация: местное время автора + его пояс.
 *
 * Контроллеры переводят время в UTC (`->utc()`), колонка scheduled_at — без
 * пояса, прод живёт по Москве. Без приведения при записи в базу ложились
 * стенные часы UTC, и публикация выходила на три часа раньше назначенного.
 */
class ScheduledAtTimezoneTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Тест о механике, не о доступе к созданию записи: авторы без подписки.
        $this->setComposeTier('auth');
    }

    public function test_post_scheduled_in_moscow_and_samara_publishes_at_the_chosen_instant(): void
    {
        $this->inAppTimezone('Europe/Moscow', function (): void {
            $cases = [
                'Europe/Moscow' => '15:00:00',  // 15:00 МСК
                'Europe/Samara' => '14:00:00',  // 15:00 по Самаре = 14:00 МСК
            ];
            $day = now()->addDays(2)->format('Y-m-d');

            foreach ($cases as $tz => $expectedMoscow) {
                $author = User::factory()->create(['status' => UserStatus::Active]);
                $post = Post::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'user_id' => $author->id,
                    'category_id' => $this->category()->id,
                    'title' => 'Черновик '.$tz,
                    'body' => 'Текст',
                    'status' => ContentStatus::Draft,
                ]);

                $this->actingAs($author, 'sanctum')
                    ->postJson("/api/v1/posts/{$post->uuid}/schedule", [
                        'scheduled_at_local' => "{$day} 15:00:00",
                        'timezone' => $tz,
                    ])->assertOk();

                $stored = $post->fresh()->scheduled_at->setTimezone('Europe/Moscow');
                $this->assertSame("{$day} {$expectedMoscow}", $stored->format('Y-m-d H:i:s'), "пояс автора {$tz}");

                // За час до срока — ещё не вышла.
                Carbon::setTestNow(Carbon::parse("{$day} {$expectedMoscow}", 'Europe/Moscow')->subHour());
                $this->artisan('posts:publish-scheduled')->assertSuccessful();
                $this->assertSame(ContentStatus::Scheduled, $post->fresh()->status, "вышла раньше срока ({$tz})");
                Carbon::setTestNow();
            }
        });
    }

    public function test_video_scheduled_in_moscow_keeps_the_chosen_instant(): void
    {
        $this->inAppTimezone('Europe/Moscow', function (): void {
            $admin = User::factory()->create(['role' => UserRole::Owner]);
            $video = $this->video($admin);
            $day = now()->addDays(2)->format('Y-m-d');

            $this->actingAs($admin, 'sanctum')
                ->postJson("/api/v1/videos/{$video->uuid}/schedule", [
                    'scheduled_at_local' => "{$day} 15:00:00",
                    'timezone' => 'Europe/Moscow',
                ])->assertOk();

            $this->assertSame(
                "{$day} 15:00:00",
                $video->fresh()->scheduled_at->setTimezone('Europe/Moscow')->format('Y-m-d H:i:s'),
            );
        });
    }

    private function category(): PostCategory
    {
        return PostCategory::query()->create([
            'name' => 'Стена', 'slug' => 'wall-'.Str::random(6), 'sort_order' => 10, 'depth' => 0, 'path' => 'wall', 'is_active' => true,
        ]);
    }

    private function video(User $admin): Video
    {
        $category = VideoCategory::query()->create(['uuid' => (string) Str::uuid(), 'title' => 'Обзоры', 'slug' => 'reviews-'.Str::random(6), 'sort_order' => 1]);
        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(), 'uploaded_by' => $admin->id, 'disk' => 'local',
            'path' => 'media/review_video/test.mp4', 'filename' => 'test.mp4', 'mime_type' => 'video/mp4',
            'size_bytes' => 1024, 'purpose' => 'review_video', 'status' => MediaStatus::Ready,
        ]);

        return Video::query()->create([
            'uuid' => (string) Str::uuid(), 'title' => 'Обзор', 'category_id' => $category->id,
            'video_media_id' => $media->id, 'uploader_id' => $admin->id, 'status' => 'published',
            'published_at' => now(), 'tags' => [],
        ]);
    }
}
