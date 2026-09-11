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
use Modules\Media\Services\MediaVariantProcessor;
use Tests\TestCase;

class MediaVariantsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('s3');
        config(['filesystems.default' => 's3']);
    }

    public function test_direct_upload_returns_ready_and_dispatches_variant_job(): void
    {
        Queue::fake();

        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $file = UploadedFile::fake()->image('lot.jpg', 1200, 800);

        $response = $this->post('/api/v1/media', [
            'purpose' => 'listing',
            'file' => $file,
        ], ['Accept' => 'application/json']);

        $response->assertCreated();
        $response->assertJsonPath('data.status', 'ready');
        $this->assertNotEmpty($response->json('data.url'));
        Queue::assertPushed(ProcessMediaVariantsJob::class);
    }

    public function test_processor_writes_webp_and_jpeg_variants(): void
    {
        if (! function_exists('imagejpeg') || ! function_exists('imagecreatetruecolor')) {
            $this->markTestSkipped('GD is required');
        }

        $user = User::factory()->create();
        $path = 'media/listing/2026/09/'.Str::uuid().'.jpg';
        Storage::disk('s3')->put($path, $this->jpegBytes(900, 600));

        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'lot.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 12_000,
            'width' => 900,
            'height' => 600,
            'uploaded_by' => $user->id,
            'status' => MediaStatus::Ready,
        ]);

        app(MediaVariantProcessor::class)->process($media->fresh());
        $media->refresh();

        $this->assertIsArray($media->variants);
        $this->assertArrayHasKey('card', $media->variants);
        $this->assertArrayHasKey('jpeg', $media->variants['card']);
        Storage::disk('s3')->assertExists($media->variants['card']['jpeg']['path']);

        if (function_exists('imagewebp')) {
            $this->assertArrayHasKey('webp', $media->variants['card']);
            Storage::disk('s3')->assertExists($media->variants['card']['webp']['path']);
        }

        $urls = $media->publicVariantUrls();
        $this->assertNotEmpty($urls['card']['jpeg'] ?? $urls['card']['webp'] ?? null);
        $this->assertStringContainsString('/card.', $urls['card']['jpeg'] ?? $urls['card']['webp']);
    }

    public function test_processor_writes_avif_variant_when_gd_supports_it(): void
    {
        if (! function_exists('imageavif')) {
            $this->markTestSkipped('GD without AVIF support');
        }

        $user = User::factory()->create();
        $path = 'media/listing/2026/09/'.Str::uuid().'.jpg';
        Storage::disk('s3')->put($path, $this->jpegBytes(400, 300));

        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'lot.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 12_000,
            'width' => 400,
            'height' => 300,
            'uploaded_by' => $user->id,
            'status' => MediaStatus::Ready,
        ]);

        app(MediaVariantProcessor::class)->process($media->fresh());
        $media->refresh();

        $this->assertArrayHasKey('avif', $media->variants['card']);
        Storage::disk('s3')->assertExists($media->variants['card']['avif']['path']);
        $this->assertStringEndsWith('/card.avif', $media->variants['card']['avif']['path']);
    }

    public function test_avif_can_be_disabled_by_config(): void
    {
        if (! function_exists('imageavif')) {
            $this->markTestSkipped('GD without AVIF support');
        }

        config(['media.variants.avif.enabled' => false]);

        $user = User::factory()->create();
        $path = 'media/listing/2026/09/'.Str::uuid().'.jpg';
        Storage::disk('s3')->put($path, $this->jpegBytes(200, 150));

        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'lot.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 8_000,
            'uploaded_by' => $user->id,
            'status' => MediaStatus::Ready,
        ]);

        app(MediaVariantProcessor::class)->process($media->fresh());
        $media->refresh();

        $this->assertArrayNotHasKey('avif', $media->variants['card']);
    }

    public function test_variant_proxy_serves_avif(): void
    {
        $original = $this->jpegBytes(40, 30);
        $variant = 'avif-bytes';
        $uuid = (string) Str::uuid();
        $origPath = 'media/listing/'.$uuid.'.jpg';
        $varPath = 'media/listing/'.$uuid.'/card.avif';
        Storage::disk('s3')->put($origPath, $original);
        Storage::disk('s3')->put($varPath, $variant);

        $owner = User::factory()->create();
        $media = Media::query()->create([
            'uuid' => $uuid,
            'disk' => 's3',
            'path' => $origPath,
            'filename' => 'lot.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => strlen($original),
            'uploaded_by' => $owner->id,
            'status' => MediaStatus::Ready,
            'variants' => [
                'card' => [
                    'avif' => ['path' => $varPath, 'bytes' => strlen($variant), 'quality' => 58],
                ],
            ],
        ]);

        $response = $this->get('/api/v1/media/'.$media->uuid.'/card.avif');
        $response->assertOk();
        $response->assertHeader('Content-Type', 'image/avif');
        $this->assertSame($variant, $response->streamedContent());
        $this->assertNotEmpty($media->publicVariantUrls()['card']['avif'] ?? null);
    }

    public function test_variant_proxy_falls_back_to_original_until_ready(): void
    {
        $payload = $this->jpegBytes(80, 60);
        $path = 'media/listing/fallback.jpg';
        Storage::disk('s3')->put($path, $payload);

        $owner = User::factory()->create();
        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'fallback.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => strlen($payload),
            'uploaded_by' => $owner->id,
            'status' => MediaStatus::Ready,
        ]);

        $response = $this->get('/api/v1/media/'.$media->uuid.'/card.webp');
        $response->assertOk();
        $this->assertStringContainsString('max-age=60', (string) $response->headers->get('Cache-Control'));
        $this->assertSame($payload, $response->streamedContent());
    }

    public function test_variant_proxy_serves_generated_file(): void
    {
        $original = $this->jpegBytes(40, 30);
        $variant = 'webp-bytes';
        $uuid = (string) Str::uuid();
        $origPath = 'media/listing/'.$uuid.'.jpg';
        $varPath = 'media/listing/'.$uuid.'/card.webp';
        Storage::disk('s3')->put($origPath, $original);
        Storage::disk('s3')->put($varPath, $variant);

        $owner = User::factory()->create();
        $media = Media::query()->create([
            'uuid' => $uuid,
            'disk' => 's3',
            'path' => $origPath,
            'filename' => 'lot.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => strlen($original),
            'uploaded_by' => $owner->id,
            'status' => MediaStatus::Ready,
            'variants' => [
                'card' => [
                    'webp' => ['path' => $varPath, 'bytes' => strlen($variant), 'quality' => 84],
                ],
            ],
        ]);

        $response = $this->get('/api/v1/media/'.$media->uuid.'/card.webp');
        $response->assertOk();
        $response->assertHeader('Content-Type', 'image/webp');
        $this->assertSame($variant, $response->streamedContent());
    }

    public function test_skips_video_purpose(): void
    {
        $user = User::factory()->create();
        $path = 'media/post_video/clip.mp4';
        Storage::disk('s3')->put($path, 'not-an-image');

        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'clip.mp4',
            'mime_type' => 'video/mp4',
            'size_bytes' => 10,
            'uploaded_by' => $user->id,
            'status' => MediaStatus::Ready,
        ]);

        app(MediaVariantProcessor::class)->process($media->fresh());
        $this->assertNull($media->fresh()->variants);
    }

    public function test_rebuild_command_queues_ready_images_without_variants(): void
    {
        Queue::fake();

        $user = User::factory()->create();
        $path = 'media/listing/rebuild.jpg';
        Storage::disk('s3')->put($path, $this->jpegBytes(80, 60));

        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'rebuild.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 100,
            'uploaded_by' => $user->id,
            'status' => MediaStatus::Ready,
        ]);

        $this->artisan('media:rebuild-variants', ['--limit' => 50])
            ->expectsOutputToContain('Queued 1')
            ->assertSuccessful();

        Queue::assertPushed(ProcessMediaVariantsJob::class, fn (ProcessMediaVariantsJob $job) => $job->mediaId === $media->id);
    }

    /** Медиа с вариантами, собранными без AVIF, — ровно как 322 на проде. */
    private function mediaWithoutAvif(int $w = 700, int $h = 500): Media
    {
        $user = User::factory()->create();
        $path = 'media/listing/2026/09/'.Str::uuid().'.jpg';
        Storage::disk('s3')->put($path, $this->jpegBytes($w, $h));

        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'lot.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 20_000,
            'width' => $w,
            'height' => $h,
            'uploaded_by' => $user->id,
            'status' => MediaStatus::Ready,
        ]);

        config(['media.variants.avif.enabled' => false]);
        app(MediaVariantProcessor::class)->process($media->fresh());
        config(['media.variants.avif.enabled' => true]);

        $media->refresh();
        $this->assertArrayNotHasKey('avif', $media->variants['card']);

        return $media;
    }

    private function avifencAvailable(): bool
    {
        return trim((string) @shell_exec('command -v avifenc 2>/dev/null')) !== '';
    }

    /*
     * Путь прода: libgd3 в Ubuntu собран без libavif, `imageavif` в PHP нет,
     * и кодирует бинарник avifenc. Проверяется, что на выходе настоящий AVIF
     * (контейнер ISOBMFF с брендом avif), а не пустышка или копия JPEG.
     */
    public function test_cli_encoder_writes_real_avif(): void
    {
        if (! $this->avifencAvailable()) {
            $this->markTestSkipped('avifenc не установлен');
        }

        config(['media.variants.avif.prefer' => 'avifenc']);
        $processor = app(MediaVariantProcessor::class);
        $this->assertSame('avifenc', $processor->avifEncoder());

        $media = $this->mediaWithoutAvif();
        $this->assertSame('added', $processor->addAvif($media->fresh()));
        $media->refresh();

        $body = Storage::disk('s3')->get($media->variants['card']['avif']['path']);
        $this->assertSame('ftyp', substr($body, 4, 4));
        $this->assertStringContainsString('avif', substr($body, 8, 16));
    }

    /*
     * Дозапись не должна трогать WebP и JPEG: их адреса отдаются с
     * `immutable` на год, и перезапись под тем же адресом разошлась бы с тем,
     * что уже лежит в кешах браузеров и nginx.
     */
    public function test_add_avif_backfills_every_size_without_touching_webp_and_jpeg(): void
    {
        $processor = app(MediaVariantProcessor::class);

        if (! $processor->avifSupported()) {
            $this->markTestSkipped('нет кодировщика AVIF');
        }

        $media = $this->mediaWithoutAvif();
        $before = [];
        foreach ($media->variants as $name => $slot) {
            foreach (['webp', 'jpeg'] as $format) {
                if (! empty($slot[$format]['path'])) {
                    $before[$name][$format] = Storage::disk('s3')->get($slot[$format]['path']);
                }
            }
        }

        $this->assertSame('added', $processor->addAvif($media->fresh()));
        $media->refresh();

        foreach ($media->variants as $name => $slot) {
            $this->assertNotEmpty($slot['avif']['path'] ?? null, "у {$name} нет AVIF");
            Storage::disk('s3')->assertExists($slot['avif']['path']);

            foreach ($before[$name] ?? [] as $format => $bytes) {
                $this->assertSame($bytes, Storage::disk('s3')->get($slot[$format]['path']), "{$name}.{$format} перезаписан");
            }
        }

        // Второй проход ничего не делает.
        $this->assertSame('skipped', $processor->addAvif($media->fresh()));
    }

    public function test_add_avif_command_dry_run_changes_nothing_and_second_run_is_a_no_op(): void
    {
        if (! app(MediaVariantProcessor::class)->avifSupported()) {
            $this->markTestSkipped('нет кодировщика AVIF');
        }

        $media = $this->mediaWithoutAvif();

        $this->artisan('media:add-avif', ['--dry-run' => true, '--sleep' => 0])
            ->expectsOutputToContain('Медиа без AVIF: 1')
            ->assertSuccessful();
        $this->assertArrayNotHasKey('avif', $media->fresh()->variants['card']);

        $this->artisan('media:add-avif', ['--sleep' => 0])
            ->expectsOutputToContain('добавлено 1')
            ->assertSuccessful();
        $this->assertArrayHasKey('avif', $media->fresh()->variants['card']);

        $this->artisan('media:add-avif', ['--sleep' => 0])
            ->expectsOutputToContain('Догонять нечего')
            ->assertSuccessful();
    }

    /*
     * Без кодировщика команда обязана отказать вслух, а не пройти «успешно»,
     * ничего не сделав: именно так AVIF два месяца молча пропускался в очереди.
     */
    public function test_add_avif_command_refuses_without_an_encoder(): void
    {
        $this->mediaWithoutAvif();
        config([
            'media.variants.avif.enabled' => true,
            'media.variants.avif.prefer' => 'avifenc',
            'media.variants.avif.avifenc' => '/nonexistent/avifenc',
        ]);

        if (function_exists('imageavif')) {
            // Встроенный кодировщик есть — выключить его можно только целиком.
            config(['media.variants.avif.enabled' => false]);
        }

        $this->app->forgetInstance(MediaVariantProcessor::class);

        $this->artisan('media:add-avif', ['--sleep' => 0])
            ->expectsOutputToContain('Кодировать AVIF нечем')
            ->assertFailed();
    }

    private function jpegBytes(int $width, int $height): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagefilledrectangle($image, 0, 0, $width, $height, imagecolorallocate($image, 40, 80, 120));
        ob_start();
        imagejpeg($image, null, 90);
        imagedestroy($image);

        return (string) ob_get_clean();
    }
}
