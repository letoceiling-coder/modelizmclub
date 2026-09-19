<?php

namespace Tests\Feature;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Enums\ContentStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\ModerationQueue;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Кто ждёт проверки в сообществе и канале.
 *
 * До 18.09 решал один флаг площадки `feed.auto_publish`: при выключенной
 * автопубликации в очередь уходила любая запись — и владельца в собственном
 * сообществе, и владельца канала. Сообщество проверено при создании,
 * владелец и назначенные им модераторы — доверенные лица.
 */
class CommunityModerationToggleTest extends TestCase
{
    use RefreshDatabase;

    private PostCategory $category;

    private User $owner;

    private Community $community;

    protected function setUp(): void
    {
        parent::setUp();
        // Тест о механике, не о доступе к созданию записи: авторы без подписки.
        $this->setComposeTier('auth');
        config(['feed.auto_publish' => false]);

        $this->category = PostCategory::query()->create([
            'name' => 'Авиация',
            'slug' => 'aviation-'.Str::random(6),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
        $this->owner = $this->user();
        $this->community = Community::query()->create([
            'category_id' => CommunityCategory::query()->create([
                'name' => 'Клубы',
                'slug' => 'clubs-'.Str::random(6),
                'sort_order' => 1,
                'is_active' => true,
            ])->id,
            'name' => 'Клуб',
            'slug' => 'club-'.Str::random(6),
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $this->owner->id,
            'access_type' => 'open',
            'members_count' => 1,
        ]);
        $this->community->members()->attach($this->owner->id, [
            'role' => CommunityMemberRole::Owner->value,
            'joined_at' => now(),
        ]);
    }

    private function user(UserRole $role = UserRole::User): User
    {
        return User::factory()->create(['status' => UserStatus::Active, 'role' => $role]);
    }

    private function member(CommunityMemberRole $role = CommunityMemberRole::Member): User
    {
        $user = $this->user();
        $this->community->members()->attach($user->id, ['role' => $role->value, 'joined_at' => now()]);

        return $user;
    }

    private function publishInCommunity(User $author): Post
    {
        $this->app['auth']->forgetGuards();
        $uuid = $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Запись',
                'body' => 'Текст',
                'category_id' => $this->category->id,
                'community_id' => $this->community->id,
            ])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($author, 'sanctum')->postJson("/api/v1/posts/{$uuid}/publish")->assertOk();

        return Post::query()->where('uuid', $uuid)->firstOrFail();
    }

    private function queued(Post $post): bool
    {
        return ModerationQueue::query()
            ->where('moderatable_type', Post::class)
            ->where('moderatable_id', $post->id)
            ->where('status', 'pending')
            ->exists();
    }

    private function toggle(User $actor, bool $value)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($actor, 'sanctum')
            ->patchJson("/api/v1/communities/{$this->community->slug}", ['moderate_member_posts' => $value]);
    }

    public function test_owner_publishes_at_once_and_skips_the_queue(): void
    {
        $post = $this->publishInCommunity($this->owner);

        $this->assertSame(ContentStatus::Published, $post->status);
        $this->assertFalse(ModerationQueue::query()->where('moderatable_id', $post->id)->where('moderatable_type', Post::class)->exists());
    }

    public function test_community_moderator_publishes_at_once(): void
    {
        $post = $this->publishInCommunity($this->member(CommunityMemberRole::Moderator));

        $this->assertSame(ContentStatus::Published, $post->status);
        $this->assertFalse($this->queued($post));
    }

    public function test_member_waits_in_the_queue_by_default_and_the_moderator_sees_it(): void
    {
        $this->assertTrue($this->community->fresh()->moderate_member_posts);
        $post = $this->publishInCommunity($this->member());

        $this->assertSame(ContentStatus::PendingModeration, $post->status);
        $this->assertTrue($this->queued($post));

        $this->app['auth']->forgetGuards();
        $ids = collect($this->actingAs($this->user(UserRole::Moderator), 'sanctum')
            ->getJson('/api/v1/admin/moderation/queue?queue=posts&status=pending')
            ->assertOk()
            ->json('data'))
            ->pluck('moderatable_id')
            ->all();
        $this->assertContains($post->id, $ids);
    }

    public function test_member_publishes_at_once_when_the_owner_turns_the_check_off(): void
    {
        $this->toggle($this->owner, false)
            ->assertOk()
            ->assertJsonPath('data.moderate_member_posts', false);

        $post = $this->publishInCommunity($this->member());

        $this->assertSame(ContentStatus::Published, $post->status);
        $this->assertFalse($this->queued($post));
    }

    public function test_switch_is_audited(): void
    {
        $this->toggle($this->owner, false)->assertOk();

        $log = AuditLog::query()->where('action', 'community.moderate_member_posts')->firstOrFail();
        $this->assertSame($this->owner->id, $log->user_id);
        $this->assertSame(Community::class, $log->auditable_type);
        $this->assertSame($this->community->id, $log->auditable_id);
        $this->assertSame(['moderate_member_posts' => true], $log->old_values);
        $this->assertSame(['moderate_member_posts' => false], $log->new_values);

        // Повтор того же значения — не изменение, в журнал не пишется.
        $this->toggle($this->owner, false)->assertOk();
        $this->assertSame(1, AuditLog::query()->where('action', 'community.moderate_member_posts')->count());
    }

    public function test_only_the_owner_switches_the_check(): void
    {
        $this->toggle($this->member(CommunityMemberRole::Moderator), false)->assertForbidden();
        $this->toggle($this->user(UserRole::Owner), false)->assertForbidden();

        $this->assertTrue($this->community->fresh()->moderate_member_posts);
        $this->assertSame(0, AuditLog::query()->where('action', 'community.moderate_member_posts')->count());
    }

    public function test_channel_team_publishes_at_once(): void
    {
        $channel = Channel::create([
            'owner_id' => $this->owner->id,
            'name' => 'Канал',
            'slug' => 'channel-'.Str::random(6),
            'kind' => 'author',
            'comments_enabled' => true,
        ]);
        $admin = $this->user();
        $channel->admins()->attach($admin->id);

        foreach ([$this->owner, $admin] as $author) {
            $this->app['auth']->forgetGuards();
            $uuid = $this->actingAs($author, 'sanctum')
                ->postJson("/api/v1/channels/{$channel->slug}/posts", ['text' => 'Новость'])
                ->assertCreated()
                ->assertJsonPath('data.status', 'published')
                ->json('data.id');

            $post = ChannelPost::query()->where('uuid', $uuid)->firstOrFail();
            $this->assertSame(ContentStatus::Published, $post->feedPost->status);
            $this->assertFalse(ModerationQueue::query()->where('moderatable_type', ChannelPost::class)->where('moderatable_id', $post->id)->exists());
        }

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->owner, 'sanctum')
            ->getJson("/api/v1/channels/{$channel->slug}")
            ->assertJsonPath('data.posts_require_moderation', false);
    }
}
