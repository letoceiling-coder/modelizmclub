<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Пересылка записи в чат спрашивает то же право, что её просмотр.
 *
 * До 03.10 не спрашивала ничего: `firstOrFail` по uuid, и `201` возвращал
 * заголовок, 120 знаков тела, превью вложения и имя автора. То есть зная uuid
 * чужого черновика или записи, снятой модерацией, её содержимое читалось
 * пересылкой в собственную беседу — в обход `PostPolicy::view`.
 */
class ChatPostForwardAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Беседа, в которую отправка уже разрешена.
     *
     * `subscription_exempt` здесь обязателен: в обычной беседе
     * `ConversationPolicy::send` требует платный доступ и отвечает 403 с кодом
     * `subscription_required`. Без этого отказ приходил бы раньше проверки
     * права на запись, и тест про постороннего проходил бы по неверной
     * причине — то есть не проверял бы ничего.
     *
     * @return array{0: User, 1: Conversation}
     */
    private function свояБеседа(): array
    {
        $пользователь = User::factory()->create(['subscription_exempt' => true]);
        $собеседник = User::factory()->create(['subscription_exempt' => true]);

        $conversation = Conversation::query()->create([
            'uuid' => (string) Str::uuid(),
            'type' => 'direct',
        ]);

        foreach ([$пользователь, $собеседник] as $участник) {
            ConversationParticipant::query()->create([
                'conversation_id' => $conversation->id,
                'user_id' => $участник->id,
            ]);
        }

        return [$пользователь, $conversation];
    }

    private function запись(User $author, ContentStatus $status): Post
    {
        return Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'status' => $status,
            'title' => 'Секретный заголовок',
            'body' => 'Тело записи, которое не должно уехать в чужой чат.',
        ]);
    }

    public static function скрытыеСтатусы(): array
    {
        return [
            'черновик' => [ContentStatus::Draft],
            'на модерации' => [ContentStatus::PendingModeration],
        ];
    }

    /** @dataProvider скрытыеСтатусы */
    public function test_a_stranger_cannot_forward_an_unpublished_post(ContentStatus $status): void
    {
        [$чужой, $conversation] = $this->свояБеседа();
        $запись = $this->запись(User::factory()->create(), $status);

        $ответ = $this->actingAs($чужой)->postJson(
            "/api/v1/conversations/{$conversation->uuid}/messages",
            ['post_uuid' => $запись->uuid, 'type' => 'post'],
        );

        $ответ->assertStatus(403);
        $this->assertStringNotContainsString('Секретный заголовок', $ответ->getContent());
        // Отказ именно по праву на запись, а не по платному доступу: иначе
        // проверка доказывала бы работу чужого замка.
        $this->assertNotSame('subscription_required', $ответ->json('code'));
    }

    public function test_the_author_can_forward_their_own_draft(): void
    {
        [$автор, $conversation] = $this->свояБеседа();
        $запись = $this->запись($автор, ContentStatus::Draft);

        $this->actingAs($автор)->postJson(
            "/api/v1/conversations/{$conversation->uuid}/messages",
            ['post_uuid' => $запись->uuid, 'type' => 'post'],
        )->assertStatus(201);
    }

    public function test_anyone_can_still_forward_a_published_post(): void
    {
        [$кто_то, $conversation] = $this->свояБеседа();
        $запись = $this->запись(User::factory()->create(), ContentStatus::Published);

        $this->actingAs($кто_то)->postJson(
            "/api/v1/conversations/{$conversation->uuid}/messages",
            ['post_uuid' => $запись->uuid, 'type' => 'post'],
        )->assertStatus(201);
    }
}
