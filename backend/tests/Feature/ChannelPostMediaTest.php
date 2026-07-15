<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\MediaStatus;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChannelPostMediaTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_publish_post_with_media_and_it_duplicates_into_feed(): void
    {
        config(['feed.auto_publish' => true]);

        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Aviation Channel',
            'slug' => 'aviation-channel',
            'kind' => 'author',
        ]);

        $media = Media::create([
            'disk' => 's3',
            'path' => 'media/channel/test.jpg',
            'filename' => 'photo.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 2048,
            'uploaded_by' => $owner->id,
            'status' => MediaStatus::Ready,
        ]);

        $response = $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", [
                'text' => 'Новый набор фото со стенда',
                'kind' => 'news',
                'media_ids' => [$media->uuid],
            ])
            ->assertCreated();

        $response->assertJsonCount(1, 'data.media');
        $response->assertJsonPath('data.media.0.media.uuid', $media->uuid);

        $channelPost = ChannelPost::query()->firstOrFail();
        $this->assertNotNull($channelPost->feed_post_id);
        $this->assertDatabaseHas('channel_post_media', [
            'channel_post_id' => $channelPost->id,
            'media_id' => $media->id,
            'type' => 'image',
        ]);

        $feedPost = $channelPost->feedPost;
        $this->assertSame(ContentStatus::Published, $feedPost->status);
        $this->assertSame($owner->id, $feedPost->user_id);
        $this->assertDatabaseHas('post_categories', ['slug' => 'channels']);
        $this->assertDatabaseHas('post_media', [
            'post_id' => $feedPost->id,
            'media_id' => $media->id,
        ]);

        $this->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $feedPost->uuid);
    }

    public function test_non_owner_cannot_publish_channel_post(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Aviation Channel',
            'slug' => 'aviation-channel-2',
            'kind' => 'author',
        ]);

        $this->actingAs($other, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", [
                'text' => 'Пробую опубликовать чужой канал',
            ])
            ->assertStatus(403);
    }
}
