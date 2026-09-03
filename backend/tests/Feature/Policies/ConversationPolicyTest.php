<?php

namespace Tests\Feature\Policies;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConversationPolicyTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    public function test_participant_views_conversation_with_can_flags(): void
    {
        $a = $this->seedUser('a');
        $b = $this->seedUser('b');
        $conversation = $this->seedConversation($a, $b);

        $this->actingAs($a, 'sanctum')
            ->getJson("/api/v1/conversations/{$conversation->uuid}")
            ->assertOk()
            ->assertJsonPath('data.can.view', true)
            ->assertJsonPath('data.can.send', true)
            ->assertJsonPath('data.can.delete', true);
    }

    public function test_stranger_gets_403_on_conversation(): void
    {
        $conversation = $this->seedConversation($this->seedUser('a'), $this->seedUser('b'));

        $this->actingAs($this->seedUser('c'), 'sanctum')
            ->getJson("/api/v1/conversations/{$conversation->uuid}")
            ->assertForbidden();
    }

    public function test_guest_gets_401_on_conversation(): void
    {
        $conversation = $this->seedConversation($this->seedUser('a'), $this->seedUser('b'));

        $this->getJson("/api/v1/conversations/{$conversation->uuid}")->assertUnauthorized();
    }

    public function test_stranger_cannot_send_message(): void
    {
        $conversation = $this->seedConversation($this->seedUser('a'), $this->seedUser('b'));

        $this->actingAs($this->seedUser('c'), 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/messages", ['body' => 'hi'])
            ->assertForbidden();
    }

    public function test_participant_sends_message(): void
    {
        $a = $this->seedUser('a');
        $conversation = $this->seedConversation($a, $this->seedUser('b'));

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/messages", ['body' => 'hi'])
            ->assertCreated();
    }

    public function test_stranger_cannot_delete_conversation(): void
    {
        $conversation = $this->seedConversation($this->seedUser('a'), $this->seedUser('b'));

        $this->actingAs($this->seedUser('c'), 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conversation->uuid}")
            ->assertForbidden();
    }
}
