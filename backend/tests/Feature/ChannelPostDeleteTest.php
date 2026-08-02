<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChannelPostDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_delete_channel_post_and_linked_feed_post(): void
    {
        config(['feed.auto_publish' => true]);

        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Aviation Channel',
            'slug' => 'aviation-channel',
            'kind' => 'author',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", [
                'text' => 'Пост для удаления',
                'kind' => 'news',
            ])
            ->assertCreated();

        $channelPost = ChannelPost::query()->firstOrFail();
        $feedPostId = $channelPost->feed_post_id;
        $this->assertNotNull($feedPostId);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/v1/channels/{$channel->slug}/posts/{$channelPost->uuid}")
            ->assertOk()
            ->assertJsonPath('message', 'Пост удалён.');

        $this->assertSoftDeleted('channel_posts', ['id' => $channelPost->id]);
        $this->assertSoftDeleted('posts', ['id' => $feedPostId]);

        $this->actingAs($owner, 'sanctum')
            ->getJson("/api/v1/channels/{$channel->slug}/posts")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_owner_can_delete_moderation_post_and_queue_entry(): void
    {
        config(['feed.auto_publish' => false]);

        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Moderated Channel',
            'slug' => 'moderated-channel',
            'kind' => 'author',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", [
                'text' => 'Пост на модерации',
                'kind' => 'news',
            ])
            ->assertCreated();

        $channelPost = ChannelPost::query()->firstOrFail();
        $this->assertSame('moderation', $channelPost->status);
        $this->assertDatabaseHas('moderation_queue', [
            'moderatable_type' => ChannelPost::class,
            'moderatable_id' => $channelPost->id,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->deleteJson("/api/v1/channels/{$channel->slug}/posts/{$channelPost->uuid}")
            ->assertOk();

        $this->assertSoftDeleted('channel_posts', ['id' => $channelPost->id]);
        $this->assertDatabaseMissing('moderation_queue', [
            'moderatable_type' => ChannelPost::class,
            'moderatable_id' => $channelPost->id,
        ]);
    }

    public function test_non_owner_cannot_delete_channel_post(): void
    {
        config(['feed.auto_publish' => true]);

        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Protected Channel',
            'slug' => 'protected-channel',
            'kind' => 'author',
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", [
                'text' => 'Защищённый пост',
                'kind' => 'news',
            ])
            ->assertCreated();

        $channelPost = ChannelPost::query()->firstOrFail();

        $this->actingAs($other, 'sanctum')
            ->deleteJson("/api/v1/channels/{$channel->slug}/posts/{$channelPost->uuid}")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['post']);

        $this->assertDatabaseHas('channel_posts', [
            'id' => $channelPost->id,
            'deleted_at' => null,
        ]);
    }
}
