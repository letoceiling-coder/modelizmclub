<?php

namespace Tests\Feature;

use App\Enums\ConversationType;
use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatListingPublicModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_list_conversations_and_send_message(): void
    {
        $a = User::factory()->create(['status' => UserStatus::Active]);
        $b = User::factory()->create(['status' => UserStatus::Active]);

        $conv = Conversation::create(['type' => ConversationType::Direct, 'last_message_at' => now()]);
        foreach ([$a, $b] as $user) {
            ConversationParticipant::create([
                'conversation_id' => $conv->id,
                'user_id' => $user->id,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        $this->actingAs($a, 'sanctum')
            ->getJson('/api/v1/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $conv->uuid);

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/conversations/{$conv->uuid}/messages", ['body' => 'Hello'])
            ->assertCreated()
            ->assertJsonPath('data.body', 'Hello');
    }

    public function test_public_listings_and_faq_endpoints(): void
    {
        $category = ListingCategory::create([
            'name' => 'Parts',
            'slug' => 'parts',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);

        Listing::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'title' => 'Motor sale',
            'slug' => 'motor-sale',
            'description' => 'Test listing',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Motor sale');

        $this->getJson('/api/v1/public/faq')->assertOk();
        $this->getJson('/api/v1/public/banners')->assertOk();
    }
}
