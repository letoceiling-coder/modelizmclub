<?php

namespace Tests\Feature;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Кто пишет в каналах и сообществах — и проверяет ли это сервер.
 *
 * Разбор 17.09 на проде: в чужих каналах публиковали модератор (1205 в
 * «modelizm») и администратор площадки (508 в «Мастерская: короткие
 * заметки»). Право давала роль из users.role, а не участие в канале.
 * Выключенные владельцем комментарии сервер не проверял вовсе.
 */
class ChannelPermissionsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Channel $channel;

    protected function setUp(): void
    {
        parent::setUp();
        // Тест о механике каналов, не о подписке: запись в канале открыта входом.
        $this->setActionTier('channel.post.create', 'auth');
        // Тест о механике, не о доступе к созданию записи: авторы без подписки.
        $this->setComposeTier('auth');
        config(['feed.auto_publish' => true]);
        $this->owner = $this->user();
        $this->channel = Channel::create([
            'owner_id' => $this->owner->id,
            'name' => 'Популярный канал',
            'slug' => 'popular-'.uniqid(),
            'kind' => 'author',
            'comments_enabled' => true,
        ]);
    }

    private function user(UserRole $role = UserRole::User): User
    {
        return User::factory()->create(['status' => UserStatus::Active, 'role' => $role]);
    }

    private function publishAs(User $user): TestResponse
    {
        return $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/channels/{$this->channel->slug}/posts", ['text' => 'Запись '.uniqid()]);
    }

    public function test_only_owner_and_channel_admins_publish(): void
    {
        $this->publishAs($this->user())->assertForbidden();
        $this->publishAs($this->user(UserRole::Moderator))->assertForbidden();
        $this->publishAs($this->user(UserRole::Owner))->assertForbidden();

        $channelAdmin = $this->user();
        $this->channel->admins()->attach($channelAdmin->id);
        $this->publishAs($channelAdmin)->assertCreated();
        $this->publishAs($this->owner)->assertCreated();

        $this->assertSame(2, ChannelPost::query()->count());
    }

    public function test_site_moderator_cannot_pin_but_can_remove_a_post(): void
    {
        $uuid = $this->publishAs($this->owner)->json('data.id');
        $moderator = $this->user(UserRole::Moderator);

        $this->actingAs($moderator, 'sanctum')
            ->postJson("/api/v1/channels/{$this->channel->slug}/posts/{$uuid}/pin")
            ->assertForbidden();
        $this->actingAs($moderator, 'sanctum')
            ->deleteJson("/api/v1/channels/{$this->channel->slug}/posts/{$uuid}")
            ->assertOk();
    }

    public function test_show_flags_split_publishing_from_moderation(): void
    {
        $moderator = $this->user(UserRole::Moderator);
        $this->actingAs($moderator, 'sanctum')
            ->getJson("/api/v1/channels/{$this->channel->slug}")
            ->assertOk()
            ->assertJsonPath('data.can_manage', false)
            ->assertJsonPath('data.can_moderate', true);

        $this->actingAs($this->owner, 'sanctum')
            ->getJson("/api/v1/channels/{$this->channel->slug}")
            ->assertJsonPath('data.can_manage', true)
            ->assertJsonPath('data.can_moderate', true);
    }

    public function test_comments_follow_the_owner_switch(): void
    {
        $this->publishAs($this->owner)->assertCreated();
        $feedUuid = ChannelPost::query()->firstOrFail()->feedPost->uuid;
        $reader = $this->user();

        $this->actingAs($reader, 'sanctum')
            ->postJson("/api/v1/posts/{$feedUuid}/comments", ['body' => 'Можно'])
            ->assertCreated();

        $this->channel->forceFill(['comments_enabled' => false])->save();

        $this->actingAs($reader, 'sanctum')
            ->postJson("/api/v1/posts/{$feedUuid}/comments", ['body' => 'Нельзя'])
            ->assertForbidden();
        $this->actingAs($this->user(UserRole::Moderator), 'sanctum')
            ->postJson("/api/v1/posts/{$feedUuid}/comments", ['body' => 'И модератору нельзя'])
            ->assertForbidden();
        $this->actingAs($this->owner, 'sanctum')
            ->postJson("/api/v1/posts/{$feedUuid}/comments", ['body' => 'Владелец отвечает'])
            ->assertCreated();
    }

    public function test_plain_post_cannot_take_the_channels_category(): void
    {
        $this->publishAs($this->owner)->assertCreated();
        $channels = PostCategory::query()->where('slug', 'channels')->firstOrFail();
        $other = PostCategory::query()->create(['name' => 'Авиация', 'slug' => 'aviation-'.uniqid(), 'is_active' => true]);
        $author = $this->user();

        $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/posts', ['title' => 'Похоже на канал', 'body' => 'Текст', 'category_id' => $channels->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['category_id']);

        $uuid = $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/posts', ['title' => 'Обычный пост', 'body' => 'Текст', 'category_id' => $other->id])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($author, 'sanctum')
            ->patchJson("/api/v1/posts/{$uuid}", ['category_id' => $channels->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['category_id']);
    }

    public function test_community_wall_is_for_members_only(): void
    {
        $category = CommunityCategory::query()->create(['name' => 'Клубы', 'slug' => 'clubs-'.uniqid(), 'is_active' => true]);
        $community = Community::create([
            'category_id' => $category->id,
            'name' => 'Клуб',
            'slug' => 'club-'.uniqid(),
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $this->owner->id,
            'members_count' => 2,
        ]);
        $community->members()->attach($this->owner->id, ['role' => CommunityMemberRole::Owner->value, 'joined_at' => now()]);
        $member = $this->user();
        $community->members()->attach($member->id, ['role' => CommunityMemberRole::Member->value, 'joined_at' => now()]);

        $post = fn (User $u) => $this->actingAs($u, 'sanctum')
            ->postJson('/api/v1/posts', ['title' => 'В клуб', 'body' => 'Текст', 'community_id' => $community->id]);

        $post($this->user())->assertStatus(422);
        $post($this->user(UserRole::Moderator))->assertStatus(422);
        $post($this->user(UserRole::Owner))->assertStatus(422);
        $post($member)->assertCreated();
        $post($this->owner)->assertCreated();
    }
}
