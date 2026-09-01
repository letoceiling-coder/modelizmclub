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
