<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Запись канала говорит о комментариях то же, что её зеркало в ленте.
 *
 * Прод 17.09: `GET /channels/{slug}/posts` не отдавал ни числа комментариев,
 * ни `can`. Страница канала рисовала «0» под каждой записью (на сервере
 * 0, 1, 1, 1, 1, 1, 2), а учётке без телефона — открытое поле: текст
 * набирался, `POST /posts/{uuid}/comments` отвечал 403 phone_not_verified,
 * и набранное пропадало. В ленте то же поле для неё заперто заранее.
 */
class ChannelPostCommentFlagsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Channel $channel;

    protected function setUp(): void
    {
        parent::setUp();
        // Тест о механике каналов, не о подписке: запись в канале открыта входом.
        $this->setActionTier('channel.post.create', 'auth');
        config(['feed.auto_publish' => true]);
        $this->owner = User::factory()->create(['status' => UserStatus::Active]);
        $this->channel = Channel::create([
            'owner_id' => $this->owner->id,
            'name' => 'Канал',
            'slug' => 'flags-'.uniqid(),
            'kind' => 'author',
            'comments_enabled' => true,
        ]);
        $this->actingAs($this->owner, 'sanctum')
            ->postJson("/api/v1/channels/{$this->channel->slug}/posts", ['text' => 'Запись'])
            ->assertCreated();
        $this->app['auth']->forgetGuards();
    }

    private function listAs(?User $user): TestResponse
    {
        $this->app['auth']->forgetGuards();
        $request = $user ? $this->actingAs($user, 'sanctum') : $this;

        return $request->getJson("/api/v1/channels/{$this->channel->slug}/posts")->assertOk();
    }

    public function test_list_carries_the_feed_posts_comment_count(): void
    {
        $feedUuid = ChannelPost::query()->firstOrFail()->feedPost->uuid;
        $reader = User::factory()->create(['status' => UserStatus::Active]);
        $this->actingAs($reader, 'sanctum')
            ->postJson("/api/v1/posts/{$feedUuid}/comments", ['body' => 'Первый'])
            ->assertCreated();
        $this->actingAs($reader, 'sanctum')
            ->postJson("/api/v1/posts/{$feedUuid}/comments", ['body' => 'Второй'])
            ->assertCreated();

        $this->listAs($reader)->assertJsonPath('data.0.comments', 2);
    }

    public function test_can_comment_matches_what_the_server_accepts(): void
    {
        $feedUuid = ChannelPost::query()->firstOrFail()->feedPost->uuid;

        $verified = User::factory()->create(['status' => UserStatus::Active]);
        $this->listAs($verified)->assertJsonPath('data.0.can.comment', true);

        $noPhone = User::factory()->create(['status' => UserStatus::Active, 'phone_verified_at' => null]);
        $this->listAs($noPhone)->assertJsonPath('data.0.can.comment', false);
        $this->actingAs($noPhone, 'sanctum')
            ->postJson("/api/v1/posts/{$feedUuid}/comments", ['body' => 'Без телефона'])
            ->assertForbidden();

        $this->listAs(null)->assertJsonPath('data.0.can.comment', false);
    }

    public function test_owner_switch_closes_comments_for_readers_only(): void
    {
        $this->channel->forceFill(['comments_enabled' => false])->save();
        $reader = User::factory()->create(['status' => UserStatus::Active]);

        $this->listAs($reader)->assertJsonPath('data.0.can.comment', false);
        $this->listAs($this->owner)->assertJsonPath('data.0.can.comment', true);
    }
}
