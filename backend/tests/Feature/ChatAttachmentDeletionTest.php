<?php

namespace Tests\Feature;

use App\Enums\MediaStatus;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * «Удалить у всех» удаляет и вложение.
 *
 * До 03.10 удалялось только сообщение, и то мягко (`SoftDeletes`). Строки
 * `message_attachments` и `media` оставались, объект в бакете тоже, а прокси
 * выдачи проверяет лишь то, что строка есть и `status = ready`. Назначение
 * `chat` стоит в `PUBLIC_PURPOSES`, поэтому ссылка продолжала отдавать файл
 * кому угодно и без входа: человек удалял сообщение, в интерфейсе вложение
 * исчезало у обоих, а по прямому адресу оставалось навсегда.
 */
class ChatAttachmentDeletionTest extends TestCase
{
    use RefreshDatabase;

    /**
     * `subscription_exempt` — чтобы отправка проходила: в обычной беседе
     * `ConversationPolicy::send` требует платный доступ.
     *
     * @return array{0: User, 1: User, 2: Conversation}
     */
    private function диалог(): array
    {
        $автор = User::factory()->create(['subscription_exempt' => true]);
        $собеседник = User::factory()->create(['subscription_exempt' => true]);

        $conversation = Conversation::query()->create([
            'uuid' => (string) Str::uuid(),
            'type' => 'direct',
        ]);

        foreach ([$автор, $собеседник] as $участник) {
            ConversationParticipant::query()->create([
                'conversation_id' => $conversation->id,
                'user_id' => $участник->id,
            ]);
        }

        return [$автор, $собеседник, $conversation];
    }

    private function вложение(User $owner): Media
    {
        $path = 'media/chat/2026/10/'.Str::uuid()->toString().'.pdf';
        Storage::disk('s3')->put($path, 'паспорт');

        return Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => $path,
            'filename' => 'passport.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 7,
            'uploaded_by' => $owner->id,
            'status' => MediaStatus::Ready,
        ]);
    }

    public function test_deleting_for_everyone_revokes_the_attachment(): void
    {
        Storage::fake('s3');
        [$автор, , $conversation] = $this->диалог();
        $media = $this->вложение($автор);

        $отправка = $this->actingAs($автор)->postJson(
            "/api/v1/conversations/{$conversation->uuid}/messages",
            ['body' => 'вот документ', 'media_uuids' => [$media->uuid]],
        );
        $отправка->assertStatus(201);
        $messageUuid = $отправка->json('data.uuid');

        // До удаления файл действительно отдаётся без входа — иначе проверка
        // ниже доказывала бы не то, что нужно.
        $this->get('/api/v1/media/'.$media->uuid)->assertOk();

        $this->actingAs($автор)
            ->deleteJson("/api/v1/conversations/{$conversation->uuid}/messages/{$messageUuid}/everyone")
            ->assertSuccessful();

        $this->assertDatabaseMissing('media', ['id' => $media->id]);
        $this->assertFalse(Storage::disk('s3')->exists($media->path));
        $this->get('/api/v1/media/'.$media->uuid)->assertStatus(404);
    }

    public function test_an_attachment_still_used_by_a_live_message_is_kept(): void
    {
        Storage::fake('s3');
        [$автор, , $conversation] = $this->диалог();
        $media = $this->вложение($автор);

        $первое = $this->actingAs($автор)->postJson(
            "/api/v1/conversations/{$conversation->uuid}/messages",
            ['body' => 'раз', 'media_uuids' => [$media->uuid]],
        );
        $первое->assertStatus(201);

        $второе = $this->actingAs($автор)->postJson(
            "/api/v1/conversations/{$conversation->uuid}/messages",
            ['body' => 'два', 'media_uuids' => [$media->uuid]],
        );
        $второе->assertStatus(201);

        $this->actingAs($автор)
            ->deleteJson("/api/v1/conversations/{$conversation->uuid}/messages/{$первое->json('data.uuid')}/everyone")
            ->assertSuccessful();

        // Второе сообщение живо, и файл нужен ему.
        $this->assertDatabaseHas('media', ['id' => $media->id]);
        $this->assertTrue(Storage::disk('s3')->exists($media->path));
        $this->get('/api/v1/media/'.$media->uuid)->assertOk();
    }
}
