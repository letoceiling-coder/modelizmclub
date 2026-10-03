<?php

namespace Tests\Feature;

use App\Enums\MediaStatus;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Приватное медиа не помечается публично кешируемым.
 *
 * До 03.10 `Cache-Control: public, max-age=31536000, immutable` уходил со всеми
 * ответами одинаково. На проде перед php-fpm стоит `fastcgi_cache` с ключом без
 * `Authorization`, поэтому первый просмотр авторизованным складывал
 * доказательство по спору в общий кеш на 30 дней, и дальше тот же адрес отдавал
 * файл без токена — до PHP запрос уже не доходил.
 *
 * Эти проверки сторожат заголовок, то есть ту половину починки, которая живёт в
 * коде. Вторая половина — в `deploy/nginx/api.modelizmclub.ru.conf`, и она
 * проверяется замером на живом nginx.
 */
class ServeMediaCacheHeadersTest extends TestCase
{
    use RefreshDatabase;

    private function media(string $purpose, User $owner): Media
    {
        Storage::fake('s3');
        $path = "media/{$purpose}/file.pdf";
        Storage::disk('s3')->put($path, 'содержимое');

        return Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'file.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 10,
            'uploaded_by' => $owner->id,
            'status' => MediaStatus::Ready,
        ]);
    }

    public function test_private_purpose_is_never_publicly_cacheable(): void
    {
        $owner = User::factory()->create();
        $media = $this->media('dispute', $owner);

        // Автор вложения — один из тех, кому `mayViewPrivate` отвечает «да»,
        // то есть это именно та ветка, которая отдаёт 200 и наполняла кеш.
        $response = $this->actingAs($owner)->get('/api/v1/media/'.$media->uuid);

        $response->assertOk();
        $заголовок = (string) $response->headers->get('Cache-Control');
        $this->assertStringContainsString('no-store', $заголовок);
        $this->assertStringContainsString('private', $заголовок);
        $this->assertStringNotContainsString('public', $заголовок);
        $this->assertStringNotContainsString('immutable', $заголовок);
    }

    public function test_public_purpose_keeps_the_long_immutable_cache(): void
    {
        $owner = User::factory()->create();
        $media = $this->media('listing', $owner);

        $response = $this->get('/api/v1/media/'.$media->uuid);

        $response->assertOk();
        $this->assertStringContainsString('max-age=31536000', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('immutable', $response->headers->get('Cache-Control'));
    }

    public function test_private_purpose_still_refuses_a_stranger(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $media = $this->media('dispute', $owner);

        $this->actingAs($stranger)->get('/api/v1/media/'.$media->uuid)->assertStatus(403);
        $this->get('/api/v1/media/'.$media->uuid)->assertStatus(403);
    }
}
