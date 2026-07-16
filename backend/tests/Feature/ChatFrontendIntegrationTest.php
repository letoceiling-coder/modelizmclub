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
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ChatFrontendIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private function usersWithProfiles(): array
    {
        $a = User::factory()->create(['status' => UserStatus::Active]);
        $b = User::factory()->create(['status' => UserStatus::Active]);

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

    public function test_forward_message_to_another_conversation(): void
    {
        [$a, $b] = $this->usersWithProfiles();
        $c = User::factory()->create(['status' => UserStatus::Active]);
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
}
