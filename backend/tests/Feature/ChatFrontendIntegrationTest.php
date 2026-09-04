<?php

namespace Tests\Feature;

use App\Enums\ConversationType;
use App\Enums\ListingStatus;
use App\Enums\MediaStatus;
use App\Enums\UserStatus;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Media;
use App\Models\Message;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Policies\PolicyFixtures;
use Tests\TestCase;

class ChatFrontendIntegrationTest extends TestCase
{
    use PolicyFixtures;

    use RefreshDatabase;

    private function usersWithProfiles(): array
    {
        $a = User::factory()->create(['status' => UserStatus::Active]);
        $this->grantSubscription($a);
        $b = User::factory()->create(['status' => UserStatus::Active]);
        $this->grantSubscription($b);

        UserProfile::create(['user_id' => $a->id, 'display_name' => 'Alice', 'slug' => 'alice']);
        UserProfile::create(['user_id' => $b->id, 'display_name' => 'Bob', 'slug' => 'bob']);

        return [$a, $b];
    }

    private function listing(User $owner): Listing
    {
        $category = ListingCategory::create([
            'name' => 'Parts',
            'slug' => 'parts',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        return Listing::create([
            'user_id' => $owner->id,
            'category_id' => $category->id,
            'title' => 'Motor sale',
            'slug' => 'motor-sale',
            'description' => 'Test listing',
            'price_cents' => 12_500,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }

    private function directConversation(User $a, User $b, ?Listing $listing = null): Conversation
    {
        $conv = Conversation::create([
            'type' => ConversationType::Direct,
            'listing_id' => $listing?->id,
            'last_message_at' => now(),
        ]);

        foreach ([$a, $b] as $user) {
            ConversationParticipant::create([
                'conversation_id' => $conv->id,
                'user_id' => $user->id,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        return $conv;
    }

    public function test_create_conversation_with_listing_and_show_it(): void
    {
        [$seller, $buyer] = $this->usersWithProfiles();
        $listing = $this->listing($seller);

        $created = $this->actingAs($buyer, 'sanctum')
            ->postJson('/api/v1/conversations', [
                'user_id' => $seller->id,
                'listing_uuid' => $listing->uuid,
            ])
            ->assertCreated()
            ->assertJsonPath('data.listing.uuid', $listing->uuid)
            ->assertJsonPath('data.listing.title', 'Motor sale')
            ->assertJsonPath('data.listing_id', $listing->id);

        $uuid = $created->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/conversations/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.listing.uuid', $listing->uuid)
            ->assertJsonPath('data.listing.price_cents', 12_500);
    }

    public function test_listing_conversation_persists_text_message_after_send(): void
    {
        [$seller, $buyer] = $this->usersWithProfiles();
        $listing = $this->listing($seller);

        $created = $this->actingAs($buyer, 'sanctum')
            ->postJson('/api/v1/conversations', [
                'user_id' => $seller->id,
                'listing_uuid' => $listing->uuid,
            ])
            ->assertCreated();

        $uuid = $created->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", [
                'body' => 'тест по объявлению',
            ])
            ->assertCreated()
            ->assertJsonPath('data.body', 'тест по объявлению');

        $messages = $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/conversations/{$uuid}/messages")
            ->assertOk()
            ->json('data');

        $this->assertTrue(
            collect($messages)->contains(fn (array $message): bool => ($message['body'] ?? null) === 'тест по объявлению'),
        );
    }

    public function test_recipient_sees_new_conversation_after_sender_starts_chat(): void
    {
        [$sender, $recipient] = $this->usersWithProfiles();

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $created = $this->actingAs($sender, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $recipient->id])
            ->assertCreated();

        $uuid = $created->json('data.uuid');

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $uuid);

        $this->actingAs($recipient, 'sanctum')
            ->getJson("/api/v1/conversations/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.uuid', $uuid);
    }

    public function test_recipient_sees_first_message_in_new_conversation(): void
    {
        [$sender, $recipient] = $this->usersWithProfiles();

        $created = $this->actingAs($sender, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $recipient->id])
            ->assertCreated();

        $uuid = $created->json('data.uuid');

        $message = $this->actingAs($sender, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", [
                'body' => 'Первое сообщение',
            ])
            ->assertCreated()
            ->assertJsonPath('data.body', 'Первое сообщение');

        $messageUuid = $message->json('data.uuid');

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $uuid)
            ->assertJsonPath('data.0.unread_count', 1)
            ->assertJsonPath('data.0.last_message.body', 'Первое сообщение');

        $this->actingAs($recipient, 'sanctum')
            ->getJson("/api/v1/conversations/{$uuid}/messages")
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $messageUuid)
            ->assertJsonPath('data.0.body', 'Первое сообщение');
    }

    public function test_upload_chat_attachment(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        $response = $this->actingAs($a, 'sanctum')
            ->post("/api/v1/conversations/{$conv->uuid}/attachments", [
                'file' => UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg'),
            ])
            ->assertCreated()
            ->assertJsonStructure(['url', 'type', 'name', 'size', 'media_uuid']);

        $this->assertSame('image', $response->json('type'));
        $mediaUuid = $response->json('media_uuid');
        $this->assertDatabaseHas('media', [
            'uuid' => $mediaUuid,
            'status' => MediaStatus::Ready->value,
        ]);

        $this->getJson("/api/v1/media/{$mediaUuid}")
            ->assertOk();
    }

    public function test_upload_chat_docx_attachment(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        $response = $this->actingAs($a, 'sanctum')
            ->post("/api/v1/conversations/{$conv->uuid}/attachments", [
                'file' => UploadedFile::fake()->create(
                    'report.docx',
                    13,
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                ),
            ])
            ->assertCreated()
            ->assertJsonPath('type', 'file')
            ->assertJsonPath('name', 'report.docx');

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/conversations/{$conv->uuid}/messages", [
                'type' => 'file',
                'media_uuids' => [$response->json('media_uuid')],
            ])
            ->assertCreated()
            ->assertJsonPath('data.attachments.0.media.filename', 'report.docx');
    }

    public function test_recipient_can_transcribe_received_voice(): void
    {
        config(['media.transcription.stub' => true]);
        [$sender, $recipient] = $this->usersWithProfiles();
        $conv = $this->directConversation($sender, $recipient);

        $media = Media::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'uploaded_by' => $sender->id,
            'disk' => 'local',
            'path' => 'media/voice/2026/07/test.ogg',
            'filename' => 'test.ogg',
            'mime_type' => 'audio/ogg',
            'size_bytes' => 1024,
            'duration_seconds' => 3,
            'status' => MediaStatus::Ready,
        ]);

        $message = Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $sender->id,
            'body' => null,
            'type' => 'voice',
            'status' => 'sent',
        ]);
        $message->attachments()->create(['media_id' => $media->id]);

        $this->actingAs($recipient, 'sanctum')
            ->postJson("/api/v1/media/{$media->uuid}/transcribe")
            ->assertOk()
            ->assertJsonStructure(['text', 'lang']);
    }

    public function test_hide_message_for_current_user_only(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        $message = Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $a->id,
            'body' => 'Secret',
            'type' => 'text',
            'status' => 'sent',
        ]);

        $this->actingAs($a, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conv->uuid}/messages/{$message->uuid}")
            ->assertOk()
            ->assertJsonPath('message', 'ok');

        $this->assertDatabaseHas('message_user_hides', [
            'user_id' => $a->id,
            'message_id' => $message->id,
        ]);

        $this->actingAs($a, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}/messages")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($b, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}/messages")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_delete_message_for_everyone_removes_it_for_both_participants(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        $message = Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $a->id,
            'body' => 'Oops',
            'type' => 'text',
            'status' => 'sent',
        ]);

        $this->actingAs($a, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conv->uuid}/messages/{$message->uuid}/everyone")
            ->assertOk()
            ->assertJsonPath('message', 'ok');

        $this->assertSoftDeleted('messages', ['id' => $message->id]);

        $this->actingAs($a, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}/messages")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($b, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}/messages")
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_delete_message_for_everyone_rejects_non_author(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        $message = Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $a->id,
            'body' => 'Mine',
            'type' => 'text',
            'status' => 'sent',
        ]);

        $this->actingAs($b, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conv->uuid}/messages/{$message->uuid}/everyone")
            ->assertForbidden(); // MessagePolicy::delete — author only
    }

    public function test_clear_conversation_history_for_current_user_only(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        foreach (['First', 'Second'] as $body) {
            Message::create([
                'conversation_id' => $conv->id,
                'user_id' => $a->id,
                'body' => $body,
                'type' => 'text',
                'status' => 'sent',
            ]);
        }

        $this->actingAs($a, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conv->uuid}/history")
            ->assertOk()
            ->assertJsonPath('message', 'ok');

        $this->actingAs($a, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}/messages")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($b, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}/messages")
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_pin_and_unpin_message(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        $message = Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $a->id,
            'body' => 'Pinned text',
            'type' => 'text',
            'status' => 'sent',
        ]);

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/conversations/{$conv->uuid}/messages/{$message->uuid}/pin")
            ->assertOk()
            ->assertJsonPath('pinned', true);

        $this->assertDatabaseHas('conversations', [
            'id' => $conv->id,
            'pinned_message_id' => $message->id,
        ]);

        $this->actingAs($a, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}")
            ->assertOk()
            ->assertJsonPath('data.pinned_message.uuid', $message->uuid);

        $this->actingAs($a, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conv->uuid}/messages/{$message->uuid}/pin")
            ->assertOk()
            ->assertJsonPath('pinned', false);

        $this->assertDatabaseHas('conversations', [
            'id' => $conv->id,
            'pinned_message_id' => null,
        ]);
    }

    public function test_pin_and_unpin_conversation(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/conversations/{$conv->uuid}/pin")
            ->assertOk()
            ->assertJsonPath('pinned', true);

        $this->assertNotNull(
            ConversationParticipant::query()
                ->where('conversation_id', $conv->id)
                ->where('user_id', $a->id)
                ->value('pinned_at'),
        );

        $this->actingAs($a, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.is_pinned', true);

        $this->actingAs($a, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conv->uuid}/pin")
            ->assertOk()
            ->assertJsonPath('pinned', false);
    }

    public function test_delete_conversation_hides_it_from_list(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        $this->actingAs($a, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($a, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conv->uuid}")
            ->assertOk()
            ->assertJsonPath('message', 'ok');

        $this->assertNotNull(
            ConversationParticipant::query()
                ->where('conversation_id', $conv->id)
                ->where('user_id', $a->id)
                ->value('left_at'),
        );

        $this->actingAs($a, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($b, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_reopening_chat_after_delete_reuses_same_conversation(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $conv = $this->directConversation($a, $b);

        $this->actingAs($a, 'sanctum')
            ->deleteJson("/api/v1/conversations/{$conv->uuid}")
            ->assertOk();

        $reopened = $this->actingAs($a, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $b->id])
            ->assertCreated();

        $this->assertSame($conv->uuid, $reopened->json('data.uuid'));

        $this->actingAs($a, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($b, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $conv->uuid);
    }

    public function test_reopening_chat_hides_duplicate_direct_conversations(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $conv1 = $this->directConversation($a, $b);

        ConversationParticipant::query()
            ->where('conversation_id', $conv1->id)
            ->where('user_id', $a->id)
            ->update(['left_at' => now()]);

        $conv2 = $this->directConversation($a, $b);

        $this->actingAs($b, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAs($a, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $b->id])
            ->assertCreated();

        $this->actingAs($b, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($a, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_forward_message_to_another_conversation(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $c = User::factory()->create(['status' => UserStatus::Active]);
        $this->grantSubscription($c);
        UserProfile::create(['user_id' => $c->id, 'display_name' => 'Carol', 'slug' => 'carol']);

        $convAb = $this->directConversation($a, $b);
        $convAc = $this->directConversation($a, $c);

        $original = Message::create([
            'conversation_id' => $convAb->id,
            'user_id' => $b->id,
            'body' => 'Original text',
            'type' => 'text',
            'status' => 'sent',
        ]);

        $response = $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/conversations/{$convAc->uuid}/messages", [
                'body' => 'Original text',
                'forwarded_from_message_uuid' => $original->uuid,
            ])
            ->assertCreated()
            ->assertJsonPath('data.forwarded_from.uuid', $original->uuid)
            ->assertJsonPath('data.body', 'Original text');

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $convAc->id,
            'forwarded_from_message_id' => $original->id,
            'body' => 'Original text',
        ]);

        $this->assertSame($original->uuid, $response->json('data.forwarded_from.uuid'));
    }

    public function test_block_and_unblock_user(): void
    {
        [$blocker, $target] = $this->usersWithProfiles();

        $this->actingAs($blocker, 'sanctum')
            ->postJson("/api/v1/users/{$target->id}/block")
            ->assertOk()
            ->assertJsonPath('message', 'ok');

        $this->assertDatabaseHas('user_blocks', [
            'blocker_id' => $blocker->id,
            'blocked_id' => $target->id,
        ]);

        $this->actingAs($blocker, 'sanctum')
            ->deleteJson("/api/v1/users/{$target->id}/block")
            ->assertOk()
            ->assertJsonPath('message', 'ok');

        $this->assertDatabaseMissing('user_blocks', [
            'blocker_id' => $blocker->id,
            'blocked_id' => $target->id,
        ]);
    }

    public function test_blocked_users_cannot_start_conversation(): void
    {
        [$blocker, $target] = $this->usersWithProfiles();

        UserBlock::create([
            'blocker_id' => $blocker->id,
            'blocked_id' => $target->id,
        ]);

        $this->actingAs($blocker, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $target->id])
            ->assertStatus(422);
    }

    public function test_update_profile_accepts_avatar_media_id_as_uuid(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->grantSubscription($user);
        UserProfile::create(['user_id' => $user->id, 'display_name' => 'User', 'slug' => 'user']);

        $media = Media::create([
            'disk' => 's3',
            'path' => 'media/avatar/test.jpg',
            'filename' => 'avatar.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
            'uploaded_by' => $user->id,
            'status' => MediaStatus::Ready,
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/v1/users/me', [
                'avatar_media_id' => $media->uuid,
            ])
            ->assertOk();

        $this->assertDatabaseHas('user_profiles', [
            'user_id' => $user->id,
            'avatar_media_id' => $media->id,
        ]);
    }

    public function test_conversation_list_includes_unread_count_and_mark_read_clears_it(): void
    {
        [$sender, $recipient] = $this->usersWithProfiles();
        $conv = $this->directConversation($sender, $recipient);

        Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $sender->id,
            'body' => 'Hello',
            'type' => 'text',
            'status' => 'sent',
        ]);
        $second = Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $sender->id,
            'body' => 'Second',
            'type' => 'text',
            'status' => 'sent',
        ]);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $conv->uuid)
            ->assertJsonPath('data.0.unread_count', 2);

        $this->actingAs($recipient, 'sanctum')
            ->postJson("/api/v1/conversations/{$conv->uuid}/read")
            ->assertOk()
            ->assertJsonPath('read', true);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.unread_count', 0);

        $participant = ConversationParticipant::query()
            ->where('conversation_id', $conv->id)
            ->where('user_id', $recipient->id)
            ->first();

        $this->assertSame($second->id, $participant?->last_read_message_id);
    }

    public function test_sent_message_is_not_read_until_recipient_opens_dialog(): void
    {
        [$sender, $recipient] = $this->usersWithProfiles();
        $conv = $this->directConversation($sender, $recipient);

        $created = $this->actingAs($sender, 'sanctum')
            ->postJson("/api/v1/conversations/{$conv->uuid}/messages", [
                'body' => 'Привет',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'sent');

        $messageUuid = $created->json('data.uuid');

        $this->assertSame(
            1,
            $recipient->fresh()->notifications()->where('data->type', 'messages')->count(),
        );

        $this->actingAs($sender, 'sanctum')
            ->postJson("/api/v1/conversations/{$conv->uuid}/messages", [
                'body' => 'Ещё одно',
            ])
            ->assertCreated();

        $this->assertSame(
            1,
            $recipient->fresh()->notifications()->where('data->type', 'messages')->count(),
        );
        $this->assertSame(
            'Ещё одно',
            $recipient->fresh()->notifications()->where('data->type', 'messages')->first()?->data['body'] ?? null,
        );

        $this->actingAs($recipient, 'sanctum')
            ->postJson("/api/v1/conversations/{$conv->uuid}/read")
            ->assertOk();

        $this->assertNotNull(
            $recipient->fresh()->notifications()->where('data->type', 'messages')->first()?->read_at,
        );

        $messages = $this->actingAs($sender, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}/messages")
            ->assertOk()
            ->json('data');

        $first = collect($messages)->firstWhere('uuid', $messageUuid);
        $this->assertNotNull($first);
        $this->assertSame('read', $first['status']);
    }

    public function test_message_is_delivered_when_recipient_was_active_after_send(): void
    {
        [$sender, $recipient] = $this->usersWithProfiles();
        $conv = $this->directConversation($sender, $recipient);

        $recipient->forceFill(['last_seen_at' => now()->subHour()])->save();

        $created = $this->actingAs($sender, 'sanctum')
            ->postJson("/api/v1/conversations/{$conv->uuid}/messages", [
                'body' => 'Ping',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'sent');

        $messageUuid = $created->json('data.uuid');

        $recipient->forceFill(['last_seen_at' => now()])->save();

        $this->actingAs($sender, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}/messages")
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $messageUuid)
            ->assertJsonPath('data.0.status', 'delivered');
    }

    public function test_category_room_conversation_is_excluded_from_messenger_list(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $direct = $this->directConversation($a, $b);

        $parent = PostCategory::create([
            'name' => 'Aviation',
            'slug' => 'aviation',
            'sort_order' => 10,
            'depth' => 0,
            'path' => 'aviation',
            'is_active' => true,
        ]);

        $sub = PostCategory::create([
            'parent_id' => $parent->id,
            'name' => 'WWII',
            'slug' => 'wwii',
            'sort_order' => 10,
            'depth' => 1,
            'path' => 'aviation/wwii',
            'is_active' => true,
        ]);

        $room = Conversation::create([
            'type' => ConversationType::Room,
            'post_category_id' => $sub->id,
            'title' => $sub->name,
            'last_message_at' => now(),
        ]);

        foreach ([$a, $b] as $user) {
            ConversationParticipant::create([
                'conversation_id' => $room->id,
                'user_id' => $user->id,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        Message::create([
            'conversation_id' => $room->id,
            'user_id' => $a->id,
            'body' => 'ПИШУ В НАПРАВЛЕНИЯ',
            'type' => 'text',
            'status' => 'sent',
        ]);

        $this->actingAs($a, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $direct->uuid)
            ->assertJsonPath('data.0.type', ConversationType::Direct->value);

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/conversations/{$room->uuid}/messages", [
                'body' => 'Ещё одно сообщение в комнату',
            ])
            ->assertCreated();

        $this->actingAs($a, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $direct->uuid);
    }

    public function test_category_room_members_returns_real_online_status(): void
    {
        [$onlineUser, $offlineUser] = $this->usersWithProfiles();

        $onlineUser->forceFill(['last_seen_at' => now()])->save();
        $offlineUser->forceFill(['last_seen_at' => now()->subHours(2)])->save();

        $parent = PostCategory::create([
            'name' => 'Armor',
            'slug' => 'armor',
            'sort_order' => 10,
            'depth' => 0,
            'path' => 'armor',
            'is_active' => true,
        ]);

        $sub = PostCategory::create([
            'parent_id' => $parent->id,
            'name' => 'APC',
            'slug' => 'apc',
            'sort_order' => 10,
            'depth' => 1,
            'path' => 'armor/apc',
            'is_active' => true,
        ]);

        $room = Conversation::create([
            'type' => ConversationType::Room,
            'post_category_id' => $sub->id,
            'title' => $sub->name,
        ]);

        foreach ([$onlineUser, $offlineUser] as $user) {
            ConversationParticipant::create([
                'conversation_id' => $room->id,
                'user_id' => $user->id,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        $this->actingAs($onlineUser, 'sanctum')
            ->getJson("/api/v1/categories/posts/{$parent->id}/rooms/{$sub->id}/members")
            ->assertOk()
            ->assertJsonPath('data.total', 2)
            ->assertJsonPath('data.online_count', 1)
            ->assertJsonCount(2, 'data.members');
    }

    public function test_conversation_exposes_last_read_cursor_for_current_user(): void
    {
        [$sender, $recipient] = $this->usersWithProfiles();
        $conv = $this->directConversation($sender, $recipient);

        $first = Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $sender->id,
            'body' => 'Первое',
            'type' => 'text',
            'status' => 'sent',
        ]);
        Message::create([
            'conversation_id' => $conv->id,
            'user_id' => $sender->id,
            'body' => 'Второе',
            'type' => 'text',
            'status' => 'sent',
        ]);

        // Пока ничего не прочитано — курсора нет, диалог откроется снизу.
        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.last_read_message_id', null)
            ->assertJsonPath('data.0.last_read_message_uuid', null);

        ConversationParticipant::query()
            ->where('conversation_id', $conv->id)
            ->where('user_id', $recipient->id)
            ->update(['last_read_message_id' => $first->id]);

        $this->actingAs($recipient, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.last_read_message_id', $first->id)
            ->assertJsonPath('data.0.last_read_message_uuid', $first->uuid)
            ->assertJsonPath('data.0.unread_count', 1);

        $this->actingAs($recipient, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}")
            ->assertOk()
            ->assertJsonPath('data.last_read_message_id', $first->id)
            ->assertJsonPath('data.last_read_message_uuid', $first->uuid);

        // Курсор собеседника наружу не течёт: у отправителя он свой.
        $this->actingAs($sender, 'sanctum')
            ->getJson("/api/v1/conversations/{$conv->uuid}")
            ->assertOk()
            ->assertJsonPath('data.last_read_message_id', null);
    }

    public function test_category_room_stats_include_unread_only_for_members(): void
    {
        [$member, $outsider] = $this->usersWithProfiles();

        $parent = PostCategory::create([
            'name' => 'Ships',
            'slug' => 'ships',
            'sort_order' => 10,
            'depth' => 0,
            'path' => 'ships',
            'is_active' => true,
        ]);

        $sub = PostCategory::create([
            'parent_id' => $parent->id,
            'name' => 'Submarines',
            'slug' => 'submarines',
            'sort_order' => 10,
            'depth' => 1,
            'path' => 'ships/submarines',
            'is_active' => true,
        ]);

        $room = Conversation::create([
            'type' => ConversationType::Room,
            'post_category_id' => $sub->id,
            'title' => $sub->name,
            'last_message_at' => now(),
        ]);

        foreach ([$member, $outsider] as $user) {
            ConversationParticipant::create([
                'conversation_id' => $room->id,
                'user_id' => $user->id,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        ConversationParticipant::query()
            ->where('conversation_id', $room->id)
            ->where('user_id', $outsider->id)
            ->update(['left_at' => now()]);

        Message::create([
            'conversation_id' => $room->id,
            'user_id' => $outsider->id,
            'body' => 'Новое в комнате',
            'type' => 'text',
            'status' => 'sent',
        ]);

        $memberStats = $this->actingAs($member, 'sanctum')
            ->getJson("/api/v1/categories/posts/{$parent->id}/rooms/stats")
            ->assertOk()
            ->assertJsonPath("data.by_subcategory.{$sub->id}.unread_count", 1)
            ->assertJsonPath("data.by_parent.{$parent->id}.unread_count", 1)
            ->json("data.by_subcategory.{$sub->id}");

        $this->assertNotNull($memberStats['last_message_at']);

        $this->actingAs($outsider, 'sanctum')
            ->getJson("/api/v1/categories/posts/{$parent->id}/rooms/stats")
            ->assertOk()
            ->assertJsonPath("data.by_subcategory.{$sub->id}.unread_count", null)
            ->assertJsonPath("data.by_subcategory.{$sub->id}.last_message_at", null)
            ->assertJsonPath("data.by_parent.{$parent->id}.unread_count", null);
    }
}
