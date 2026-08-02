<?php

namespace Tests\Feature;

use App\Enums\MediaStatus;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ServeMediaRangeTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_media_proxy_supports_byte_range_requests(): void
    {
        Storage::fake('s3');
        $payload = str_repeat('a', 1000);
        Storage::disk('s3')->put('media/review_video/test.mp4', $payload);

        $owner = User::factory()->create();
        $media = Media::query()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'disk' => 's3',
            'path' => 'media/review_video/test.mp4',
            'filename' => 'test.mp4',
            'mime_type' => 'video/mp4',
            'size_bytes' => strlen($payload),
            'uploaded_by' => $owner->id,
            'purpose' => 'review_video',
            'status' => MediaStatus::Ready,
        ]);

        $response = $this->call(
            'GET',
            '/api/v1/media/'.$media->uuid,
            [],
            [],
            [],
            ['HTTP_RANGE' => 'bytes=0-99'],
        );

        $response->assertStatus(206);
        $response->assertHeader('Content-Range', 'bytes 0-99/1000');
        $this->assertSame(100, strlen($response->getContent()));
        $response->assertHeader('Accept-Ranges', 'bytes');
    }
}
