<?php

namespace Tests\Feature\Policies;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessagePolicyTest extends TestCase
{
    use PolicyFixtures;
    use RefreshDatabase;

    public function test_author_deletes_message_for_everyone(): void
    {
        $a = $this->seedUser('a');
        $conversation = $this->seedConversation($a, $this->seedUser('b'));
        $message = $this->seedMessage($conversation, $a);

        $this->actingAs($a, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conversation->uuid}/messages/{$message->uuid}/everyone")
            ->assertOk();
    }

    public function test_other_participant_cannot_delete_for_everyone(): void
    {
        $a = $this->seedUser('a');
        $b = $this->seedUser('b');
        $conversation = $this->seedConversation($a, $b);
        $message = $this->seedMessage($conversation, $a);

        $this->actingAs($b, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conversation->uuid}/messages/{$message->uuid}/everyone")
            ->assertForbidden();
    }

    public function test_stranger_cannot_touch_message(): void
    {
        $a = $this->seedUser('a');
        $conversation = $this->seedConversation($a, $this->seedUser('b'));
        $message = $this->seedMessage($conversation, $a);
        $stranger = $this->seedUser('c');

        $this->actingAs($stranger, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conversation->uuid}/messages/{$message->uuid}/everyone")
            ->assertForbidden();
        $this->actingAs($stranger, 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/messages/{$message->uuid}/pin")
            ->assertForbidden();
    }

    public function test_participant_pins_message_and_sees_can_flags(): void
    {
        $a = $this->seedUser('a');
        $b = $this->seedUser('b');
        $conversation = $this->seedConversation($a, $b);
        $message = $this->seedMessage($conversation, $a);

        $this->actingAs($b, 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/messages/{$message->uuid}/pin")
            ->assertOk();

        $this->assertTrue($a->can('delete', $message));
        $this->assertFalse($b->can('delete', $message));
        $this->assertTrue($b->can('hide', $message));
    }

    public function test_message_list_carries_can_flags(): void
    {
        $a = $this->seedUser('a');
        $b = $this->seedUser('b');
        $conversation = $this->seedConversation($a, $b);
        $this->seedMessage($conversation, $a);

        $this->actingAs($b, 'sanctum')
            ->getJson("/api/v1/conversations/{$conversation->uuid}/messages")
            ->assertOk()
            ->assertJsonPath('data.0.can.delete', false)
            ->assertJsonPath('data.0.can.hide', true);
    }
}
