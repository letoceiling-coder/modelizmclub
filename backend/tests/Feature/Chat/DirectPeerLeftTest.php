<?php

namespace Tests\Feature\Chat;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Feature\Policies\PolicyFixtures;
use Tests\TestCase;

/**
 * Отправитель должен видеть, что собеседник вышел.
 *
 * Подписку на канал беседы даёт только участие без `left_at`: ушедший живых
 * сообщений не получает вовсе. До 21.09 отправителю об этом не говорили
 * ничего — письмо помечалось «отправлено» и оставалось таким навсегда, и
 * отличить «не прочитал» от «не услышит» было нельзя.
 *
 * На проде нашлись и беседы вообще без второй стороны — девять штук, из
 * времён до нынешнего кода. Для отправителя это то же самое.
 */
class DirectPeerLeftTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    /** @return array{Conversation, \App\Models\User, \App\Models\User} */
    private function direct(?string $peerLeftAt): array
    {
        $me = $this->seedUser('me');
        $peer = $this->seedUser('peer');
        $conversation = Conversation::query()->create([
            'uuid' => (string) Str::uuid(),
            'type' => ConversationType::Direct,
            'last_message_at' => now(),
        ]);
        ConversationParticipant::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => $me->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);
        ConversationParticipant::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => $peer->id,
            'role' => 'member',
            'joined_at' => now(),
            'left_at' => $peerLeftAt,
        ]);

        return [$conversation, $me, $peer];
    }

    public function test_peer_still_in_conversation_is_not_reported_as_left(): void
    {
        [, $me] = $this->direct(null);

        $this->actingAs($me)->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.peer_left', false);
    }

    public function test_peer_who_left_is_reported(): void
    {
        [, $me] = $this->direct(now()->toDateTimeString());

        $this->actingAs($me)->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.peer_left', true);
    }

    public function test_peer_who_left_keeps_their_name_in_the_title(): void
    {
        // Название берётся из той же строки участника. Если её отфильтровать
        // при загрузке, диалог превратится в безымянный «Диалог» — то есть
        // починка отняла бы больше, чем дала.
        [, $me] = $this->direct(now()->toDateTimeString());

        $this->actingAs($me)->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'User peer');
    }

    public function test_conversation_without_the_second_side_is_reported_as_left(): void
    {
        $me = $this->seedUser('alone');
        $conversation = Conversation::query()->create([
            'uuid' => (string) Str::uuid(),
            'type' => ConversationType::Direct,
            'last_message_at' => now(),
        ]);
        ConversationParticipant::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => $me->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        $this->actingAs($me)->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.peer_left', true);
    }
}
