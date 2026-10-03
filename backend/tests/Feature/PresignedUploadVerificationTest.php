<?php

namespace Tests\Feature;

use App\Enums\MediaStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Support\FakeMediaBytes;
use Tests\TestCase;

/**
 * Пресайн-загрузка: роль и содержимое.
 *
 * Два пути загрузки один раз уже разошлись. Прямой перехватывал `purpose=icon`
 * и требовал Владельца, а пресайн-сессия принимала любое назначение из
 * `purposes()` и вообще не смотрела на то, что легло в бакет: тип и размер
 * брались из JSON-тела, а байты клиент кладёт мимо приложения.
 */
class PresignedUploadVerificationTest extends TestCase
{
    use RefreshDatabase;

    private function человек(): User
    {
        return User::factory()->create(['status' => UserStatus::Active]);
    }

    /** @return array{0: string, 1: string, 2: string} сессия, uuid медиа, путь */
    private function сессия(User $user, string $purpose, string $mime, string $name, int $size = 1024): array
    {
        $data = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/upload-session', [
                'purpose' => $purpose,
                'files' => [['name' => $name, 'size' => $size, 'mime' => $mime]],
            ])
            ->assertCreated()
            ->json('data');

        return [$data['session_uuid'], $data['uploads'][0]['media_uuid'], $data['uploads'][0]['path']];
    }

    public function test_an_ordinary_user_cannot_open_an_icon_session(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $this->actingAs($this->человек(), 'sanctum')
            ->postJson('/api/v1/media/upload-session', [
                'purpose' => 'icon',
                'files' => [['name' => 'x.svg', 'size' => 200, 'mime' => 'image/svg+xml']],
            ])
            ->assertStatus(403);
    }

    public function test_an_ordinary_user_cannot_open_a_logo_session(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $this->actingAs($this->человек(), 'sanctum')
            ->postJson('/api/v1/media/upload-session', [
                'purpose' => 'logo',
                'files' => [['name' => 'x.svg', 'size' => 200, 'mime' => 'image/svg+xml']],
            ])
            ->assertStatus(403);
    }

    public function test_the_owner_still_can(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $владелец = User::factory()->create(['status' => UserStatus::Active, 'role' => UserRole::Owner]);

        $this->actingAs($владелец, 'sanctum')
            ->postJson('/api/v1/media/upload-session', [
                'purpose' => 'icon',
                'files' => [['name' => 'x.png', 'size' => 200, 'mime' => 'image/png']],
            ])
            ->assertCreated();
    }

    public function test_confirm_refuses_content_that_is_not_the_declared_type(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);
        $user = $this->человек();

        [$session, $mediaUuid, $path] = $this->сессия($user, 'post', 'image/jpeg', 'photo.jpg');

        // Заявили картинку, положили текст — ровно та подмена, ради которой
        // проверка и заводилась.
        Storage::disk('s3')->put($path, FakeMediaBytes::garbage());

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/confirm', [
                'session_uuid' => $session,
                'media_uuids' => [$mediaUuid],
            ])
            ->assertStatus(422);

        // Загрузка закрыта, объект убран: иначе файл остался бы лежать и
        // ждать, пока на него кто-нибудь сошлётся.
        $this->assertDatabaseHas('media', [
            'uuid' => $mediaUuid,
            'status' => MediaStatus::Failed->value,
        ]);
        $this->assertFalse(Storage::disk('s3')->exists($path));
    }

    public function test_confirm_refuses_a_file_bigger_than_the_limit(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);
        $user = $this->человек();

        // Заявлен один килобайт; предел `avatar` — 5 МиБ.
        [$session, $mediaUuid, $path] = $this->сессия($user, 'avatar', 'image/png', 'me.png', 1024);

        Storage::disk('s3')->put($path, FakeMediaBytes::png().str_repeat("\x00", 6 * 1024 * 1024));

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/confirm', [
                'session_uuid' => $session,
                'media_uuids' => [$mediaUuid],
            ])
            ->assertStatus(422);

        $this->assertFalse(Storage::disk('s3')->exists($path));
    }

    public function test_confirm_records_the_real_type_and_size(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);
        $user = $this->человек();

        // Заявлен png, положен настоящий jpeg. Оба в списке `post`, так что
        // загрузка проходит, но в базе должен оказаться фактический тип.
        [$session, $mediaUuid, $path] = $this->сессия($user, 'post', 'image/png', 'photo.png');
        $байты = FakeMediaBytes::jpeg();
        Storage::disk('s3')->put($path, $байты);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media/confirm', [
                'session_uuid' => $session,
                'media_uuids' => [$mediaUuid],
            ])
            ->assertOk();

        $media = Media::query()->where('uuid', $mediaUuid)->firstOrFail();
        $this->assertSame('image/jpeg', $media->mime_type);
        $this->assertSame(strlen($байты), (int) $media->size_bytes);
    }

    public function test_svg_is_never_served_as_a_document(): void
    {
        Storage::fake('s3');
        $владелец = User::factory()->create(['role' => UserRole::Owner]);

        $path = 'media/icon/2026/10/'.Str::uuid()->toString().'.svg';
        Storage::disk('s3')->put($path, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'icon.svg',
            'mime_type' => 'image/svg+xml',
            'size_bytes' => 72,
            'uploaded_by' => $владелец->id,
            'status' => MediaStatus::Ready,
        ]);

        $ответ = $this->get('/api/v1/media/'.$media->uuid)->assertOk();

        // Исполняемым типом не отдаём и `inline` не ставим: SVG — документ со
        // скриптом, а CSP на хосте API нет.
        $this->assertStringNotContainsString('svg', (string) $ответ->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment', (string) $ответ->headers->get('Content-Disposition'));
    }
}
