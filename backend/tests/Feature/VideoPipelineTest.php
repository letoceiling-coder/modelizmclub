<?php

namespace Tests\Feature;

use App\Enums\MediaStatus;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Modules\Media\Jobs\ProcessMediaVariantsJob;
use Modules\Media\Jobs\ProcessVideoJob;
use Modules\Media\Services\VideoProcessor;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/**
 * Постер и облегчённая копия видео.
 *
 * Лента показывала исходник: 14,1 МБ на первый же экран, без постера и без
 * известных размеров кадра. Проверяем, что конвейер ставится в очередь, что
 * его результат виден в API и что новые адреса отдаются тем же прокси.
 */
class VideoPipelineTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('s3');
        config(['filesystems.default' => 's3']);
    }

    public function test_video_upload_dispatches_the_video_job_not_the_image_one(): void
    {
        Queue::fake();

        Sanctum::actingAs(User::factory()->create());

        $response = $this->post('/api/v1/media', [
            'purpose' => 'post_video',
            'file' => UploadedFile::fake()->create('clip.mp4', 400, 'video/mp4'),
        ], ['Accept' => 'application/json']);

        $response->assertCreated();
        Queue::assertPushed(ProcessVideoJob::class);
        Queue::assertNotPushed(ProcessMediaVariantsJob::class);
    }

    public function test_api_reports_processing_until_a_poster_exists(): void
    {
        $media = $this->videoRow();

        $this->assertSame('processing', $media->toApiArray()['video']['status']);
        $this->assertArrayNotHasKey('poster', $media->toApiArray()['video']);
    }

    public function test_api_reports_ready_with_poster_and_rendition(): void
    {
        $media = $this->videoRow([
            'poster' => ['webp' => ['path' => 'media/post_video/clip/poster.webp', 'bytes' => 8704]],
            '720p' => ['mp4' => ['path' => 'media/post_video/clip/720p.mp4', 'bytes' => 4_000_000]],
        ]);

        $video = $media->toApiArray()['video'];

        $this->assertSame('ready', $video['status']);
        $this->assertStringEndsWith('/poster.webp', $video['poster']);
        $this->assertSame('720p', $video['sources'][0]['quality']);
        $this->assertStringEndsWith('/720p.mp4', $video['sources'][0]['url']);
    }

    public function test_api_reports_failed_after_the_job_gives_up(): void
    {
        $media = $this->videoRow();
        VideoProcessor::markFailed($media);

        $this->assertSame('failed', $media->fresh()->toApiArray()['video']['status']);
    }

    public function test_image_media_carries_no_video_block(): void
    {
        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'media/post/photo.jpg',
            'filename' => 'photo.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
            'status' => MediaStatus::Ready,
        ]);

        $this->assertArrayNotHasKey('video', $media->toApiArray());
    }

    public function test_poster_and_rendition_are_served_by_the_media_proxy(): void
    {
        $media = $this->videoRow([
            'poster' => ['webp' => ['path' => 'media/post_video/clip/poster.webp', 'bytes' => 5]],
        ]);
        Storage::disk('s3')->put('media/post_video/clip/poster.webp', 'FRAME');

        $this->get('/api/v1/media/'.$media->uuid.'/poster.webp')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/webp');

        // Копии ещё нет — прокси отдаёт исходник, а не 404: слайд не должен
        // остаться пустым, пока очередь не дошла до ролика.
        Storage::disk('s3')->put($media->path, 'ORIGINAL');
        $this->get('/api/v1/media/'.$media->uuid.'/720p.mp4')->assertOk();
    }

    public function test_unknown_variant_name_is_still_rejected(): void
    {
        $media = $this->videoRow();
        Storage::disk('s3')->put($media->path, 'ORIGINAL');

        $this->get('/api/v1/media/'.$media->uuid.'/1080p.mp4')->assertNotFound();
    }

    /**
     * Настоящий прогон конвейера на ролике, собранном ffmpeg прямо здесь.
     *
     * Пропускается там, где ffmpeg не установлен, — на сервере он есть
     * (ffmpeg 6.1.1, проверено 06.09). Постер кодирует GD, а не ffmpeg,
     * поэтому сборка ffmpeg без libwebp тесту не мешает.
     */
    public function test_pipeline_writes_a_poster_within_budget_and_fills_dimensions(): void
    {
        if (! $this->hasFfmpeg() || ! function_exists('imagewebp')) {
            $this->markTestSkipped('ffmpeg или GD с webp недоступны');
        }

        $file = tempnam(sys_get_temp_dir(), 'vsrc').'.mp4';
        $make = new Process([
            'ffmpeg', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=15:duration=2',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', $file,
        ]);
        $make->setTimeout(120);
        $make->run();

        $this->assertTrue($make->isSuccessful(), 'не удалось собрать тестовый ролик');

        $media = $this->videoRow();
        Storage::disk('s3')->put($media->path, (string) file_get_contents($file));
        $media->size_bytes = (int) filesize($file);
        $media->save();
        @unlink($file);

        app(VideoProcessor::class)->process($media);
        $media->refresh();

        $this->assertSame(1280, $media->width);
        $this->assertSame(720, $media->height);
        $this->assertSame(2, $media->duration_seconds);

        $poster = $media->variants[VideoProcessor::POSTER]['webp'] ?? null;
        $this->assertIsArray($poster, 'постер не записан');
        $this->assertTrue(Storage::disk('s3')->exists($poster['path']));
        $this->assertLessThanOrEqual(
            100 * 1024,
            $poster['bytes'],
            'постер должен укладываться в 100 КБ первого экрана',
        );
        $this->assertSame('ready', $media->toApiArray()['video']['status']);
    }

    /**
     * @param  array<string, mixed>  $variants
     */
    private function videoRow(array $variants = []): Media
    {
        return Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'media/post_video/clip.mp4',
            'filename' => 'clip.mp4',
            'mime_type' => 'video/mp4',
            'size_bytes' => 14_131_942,
            'status' => MediaStatus::Ready,
            'variants' => $variants === [] ? null : $variants,
        ]);
    }

    private function hasFfmpeg(): bool
    {
        $check = new Process(['sh', '-c', 'command -v ffmpeg && command -v ffprobe']);
        $check->setTimeout(10);
        $check->run();

        return $check->isSuccessful();
    }
}
