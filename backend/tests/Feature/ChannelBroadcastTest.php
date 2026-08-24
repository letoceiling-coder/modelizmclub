<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChannelBroadcastTest extends TestCase
{
    use RefreshDatabase;

    public function test_like_and_unlike_channel_post_are_recorded(): void
    {
        config(['feed.auto_publish' => true]);

        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $viewer = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Brand Channel',
            'slug' => 'brand-likes',
            'kind' => 'brand',
            'is_active' => true,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", [
                'text' => 'Новость для реакций',
                'kind' => 'news',
            ])
            ->assertCreated();

        $post = ChannelPost::query()->firstOrFail();

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts/{$post->uuid}/like")
            ->assertOk()
            ->assertJsonPath('data.liked', true)
            ->assertJsonPath('data.likes', 1);

        $this->assertDatabaseHas('post_reactions', [
            'post_id' => $post->feed_post_id,
            'user_id' => $viewer->id,
        ]);

        $this->actingAs($viewer, 'sanctum')
            ->deleteJson("/api/v1/channels/{$channel->slug}/posts/{$post->uuid}/like")
            ->assertOk()
            ->assertJsonPath('data.liked', false)
            ->assertJsonPath('data.likes', 0);
    }

    public function test_views_are_unique_for_auth_user_and_guest_session(): void
    {
        config(['feed.auto_publish' => true]);

        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $viewer = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Views Channel',
            'slug' => 'views-channel',
            'kind' => 'official',
            'is_active' => true,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", [
                'text' => 'Пост для просмотров',
                'kind' => 'news',
            ])
            ->assertCreated();

        $post = ChannelPost::query()->firstOrFail();

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts/{$post->uuid}/view")
            ->assertOk()
            ->assertJsonPath('data.counted', false)
            ->assertJsonPath('data.views', 0);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts/{$post->uuid}/view")
            ->assertOk()
            ->assertJsonPath('data.counted', true)
            ->assertJsonPath('data.views', 1);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts/{$post->uuid}/view")
            ->assertOk()
            ->assertJsonPath('data.counted', false)
            ->assertJsonPath('data.views', 1);

        $this->app['auth']->forgetGuards();

        $this->postJson("/api/v1/channels/{$channel->slug}/posts/{$post->uuid}/view", [], [
            'X-Guest-Viewer' => 'guest-session-abc12345',
        ])
            ->assertOk()
            ->assertJsonPath('data.counted', true)
            ->assertJsonPath('data.views', 2);

        $this->postJson("/api/v1/channels/{$channel->slug}/posts/{$post->uuid}/view", [], [
            'X-Guest-Viewer' => 'guest-session-abc12345',
        ])
            ->assertOk()
            ->assertJsonPath('data.counted', false)
            ->assertJsonPath('data.views', 2);
    }

    public function test_official_and_brand_posts_appear_in_feed_with_channel_plaque(): void
    {
        config(['feed.auto_publish' => true]);

        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $brand = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Tamiya',
            'slug' => 'tamiya-feed',
            'kind' => 'brand',
            'is_active' => true,
        ]);
        $author = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Personal blog',
            'slug' => 'personal-blog',
            'kind' => 'author',
            'is_active' => true,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$brand->slug}/posts", [
                'text' => 'Официальная новость бренда',
                'kind' => 'news',
            ])
            ->assertCreated();

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$author->slug}/posts", [
                'text' => 'Личный авторский пост',
                'kind' => 'news',
            ])
            ->assertCreated();

        $brandPost = ChannelPost::query()->where('channel_id', $brand->id)->firstOrFail();

        $this->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $brandPost->feedPost->uuid)
            ->assertJsonPath('data.0.channel.slug', 'tamiya-feed')
            ->assertJsonPath('data.0.channel.name', 'Tamiya')
            ->assertJsonPath('data.0.channel.kind', 'brand');
    }

    public function test_owner_can_pin_post_and_it_comes_first(): void
    {
        config(['feed.auto_publish' => true]);

        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Pin Channel',
            'slug' => 'pin-channel',
            'kind' => 'shop',
            'is_active' => true,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", [
                'text' => 'Первый пост',
                'kind' => 'news',
            ])
            ->assertCreated();
        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", [
                'text' => 'Второй пост',
                'kind' => 'announce',
            ])
            ->assertCreated();

        $first = ChannelPost::query()->where('text', 'Первый пост')->firstOrFail();

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts/{$first->uuid}/pin")
            ->assertOk()
            ->assertJsonPath('data.pinned', true);

        $this->actingAs($owner, 'sanctum')
            ->getJson("/api/v1/channels/{$channel->slug}/posts")
            ->assertOk()
            ->assertJsonPath('data.0.text', 'Первый пост')
            ->assertJsonPath('data.0.pinned', true);
    }

    public function test_show_returns_can_manage_only_for_owner(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $other = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Manage Channel',
            'slug' => 'manage-channel',
            'kind' => 'author',
            'is_active' => true,
            'comments_enabled' => true,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->getJson("/api/v1/channels/{$channel->slug}")
            ->assertOk()
            ->assertJsonPath('data.is_owner', true)
            ->assertJsonPath('data.can_manage', true)
            ->assertJsonPath('data.comments_enabled', true);

        $this->actingAs($other, 'sanctum')
            ->getJson("/api/v1/channels/{$channel->slug}")
            ->assertOk()
            ->assertJsonPath('data.is_owner', false)
            ->assertJsonPath('data.can_manage', false);
    }
}
