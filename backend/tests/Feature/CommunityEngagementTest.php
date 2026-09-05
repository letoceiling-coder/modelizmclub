<?php

namespace Tests\Feature;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Enums\UserStatus;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\PostCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Уведомления, избранное, похожие и приглашения.
 *
 * Проверяем не только счастливый путь, но и то, что каждый адрес закрыт
 * политикой: до этой ветки права на сообщество считались в трёх местах
 * по-разному — `isOwnedBy` и `canManage` в модели и запросы к сводной
 * таблице в сервисах.
 */
class CommunityEngagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    // ── уведомления ─────────────────────────────────────────────────────────

    public function test_member_switches_notifications_off_and_back_on(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $member = $this->joinedUser($community);

        Sanctum::actingAs($member);

        $this->putJson("/api/v1/communities/{$community->slug}/notifications", ['enabled' => false])
            ->assertOk()
            ->assertJsonPath('data.notifications_enabled', false);

        $this->assertFalse((bool) $this->memberFlag($community, $member));

        $this->putJson("/api/v1/communities/{$community->slug}/notifications", ['enabled' => true])
            ->assertOk()
            ->assertJsonPath('data.notifications_enabled', true);

        $this->assertTrue((bool) $this->memberFlag($community, $member));
    }

    public function test_notifications_are_on_by_default_for_a_new_member(): void
    {
        $community = $this->community($this->user());
        $member = $this->joinedUser($community);

        $this->assertTrue((bool) $this->memberFlag($community, $member));
    }

    public function test_stranger_cannot_touch_notifications(): void
    {
        $community = $this->community($this->user());
        Sanctum::actingAs($this->user());

        $this->putJson("/api/v1/communities/{$community->slug}/notifications", ['enabled' => false])
            ->assertForbidden();
    }

    // ── избранное ───────────────────────────────────────────────────────────

    public function test_favorite_is_added_removed_and_visible_in_the_resource(): void
    {
        $community = $this->community($this->user());
        $viewer = $this->user();
        Sanctum::actingAs($viewer);

        $this->getJson("/api/v1/communities/{$community->slug}")
            ->assertOk()
            ->assertJsonPath('data.is_favorite', false);

        $this->postJson("/api/v1/communities/{$community->slug}/favorite")
            ->assertOk()
            ->assertJsonPath('data.is_favorite', true);

        $this->getJson("/api/v1/communities/{$community->slug}")
            ->assertJsonPath('data.is_favorite', true);

        $this->deleteJson("/api/v1/communities/{$community->slug}/favorite")
            ->assertOk()
            ->assertJsonPath('data.is_favorite', false);
    }

    public function test_adding_a_favorite_twice_is_not_an_error(): void
    {
        $community = $this->community($this->user());
        Sanctum::actingAs($this->user());

        $this->postJson("/api/v1/communities/{$community->slug}/favorite")->assertOk();
        $this->postJson("/api/v1/communities/{$community->slug}/favorite")->assertOk();

        $this->assertSame(1, DB::table('community_favorites')->count());
    }

    public function test_favorite_needs_a_session(): void
    {
        $community = $this->community($this->user());

        $this->postJson("/api/v1/communities/{$community->slug}/favorite")->assertUnauthorized();
    }

    // ── похожие ─────────────────────────────────────────────────────────────

    public function test_similar_matches_by_category_and_skips_the_current_one(): void
    {
        $owner = $this->user();
        $category = $this->communityCategory();
        $current = $this->community($owner, $category);
        $sibling = $this->community($owner, $category);
        $stranger = $this->community($owner, $this->communityCategory());

        $slugs = collect($this->getJson("/api/v1/communities/{$current->slug}/similar")
            ->assertOk()
            ->json('data'))->pluck('slug');

        $this->assertContains($sibling->slug, $slugs);
        $this->assertNotContains($current->slug, $slugs, 'текущее сообщество не должно быть похоже само на себя');
        $this->assertNotContains($stranger->slug, $slugs);
    }

    public function test_similar_matches_by_shared_topics_too(): void
    {
        $owner = $this->user();
        $topic = $this->postCategory();
        $current = $this->community($owner);
        $byTopic = $this->community($owner);

        foreach ([$current, $byTopic] as $c) {
            DB::table('community_topic_categories')->insert([
                'community_id' => $c->id,
                'post_category_id' => $topic->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $slugs = collect($this->getJson("/api/v1/communities/{$current->slug}/similar")->json('data'))
            ->pluck('slug');

        $this->assertContains($byTopic->slug, $slugs);
    }

    public function test_similar_returns_at_most_five(): void
    {
        $owner = $this->user();
        $category = $this->communityCategory();
        $current = $this->community($owner, $category);

        foreach (range(1, 7) as $ignored) {
            $this->community($owner, $category);
        }

        $this->getJson("/api/v1/communities/{$current->slug}/similar")
            ->assertOk()
            ->assertJsonCount(5, 'data');
    }

    public function test_similar_is_open_to_a_guest(): void
    {
        $community = $this->community($this->user());

        $this->getJson("/api/v1/communities/{$community->slug}/similar")->assertOk();
    }

    // ── приглашения ─────────────────────────────────────────────────────────

    public function test_invitable_friends_skip_those_already_inside(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $outsider = $this->user();
        $insider = $this->joinedUser($community);
        $this->befriend($owner, $outsider);
        $this->befriend($owner, $insider);

        Sanctum::actingAs($owner);

        $uuids = collect($this->getJson("/api/v1/communities/{$community->slug}/invitable-friends")
            ->assertOk()
            ->json('data'))->pluck('uuid');

        $this->assertContains($outsider->uuid, $uuids);
        $this->assertNotContains($insider->uuid, $uuids);
    }

    public function test_invite_notifies_friends_outside_the_community(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $friend = $this->user();
        $this->befriend($owner, $friend);

        Sanctum::actingAs($owner);

        $this->postJson("/api/v1/communities/{$community->slug}/invite", [
            'user_uuids' => [$friend->uuid],
        ])
            ->assertOk()
            ->assertJsonPath('data.sent', 1);

        $this->assertSame(1, $friend->notifications()->count());
    }

    public function test_invite_silently_skips_a_stranger_uuid(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);
        $notAFriend = $this->user();

        Sanctum::actingAs($owner);

        $this->postJson("/api/v1/communities/{$community->slug}/invite", [
            'user_uuids' => [$notAFriend->uuid],
        ])
            ->assertOk()
            ->assertJsonPath('data.sent', 0);

        $this->assertSame(0, $notAFriend->notifications()->count());
    }

    public function test_outsider_cannot_invite(): void
    {
        $community = $this->community($this->user());
        Sanctum::actingAs($this->user());

        $this->getJson("/api/v1/communities/{$community->slug}/invitable-friends")->assertForbidden();
    }

    // ── ресурс ──────────────────────────────────────────────────────────────

    public function test_resource_carries_created_at_owner_and_can(): void
    {
        $owner = $this->user();
        $community = $this->community($owner);

        Sanctum::actingAs($owner);
        $data = $this->getJson("/api/v1/communities/{$community->slug}")->assertOk()->json('data');

        $this->assertNotNull($data['created_at']);
        $this->assertSame($owner->uuid, $data['owner']['uuid']);
        $this->assertArrayHasKey('name', $data['owner']);
        $this->assertArrayHasKey('avatar', $data['owner']);
        $this->assertArrayHasKey('slug', $data['owner']);

        // Владелец: управляет и публикует, звать может, вступать некуда,
        // выйти нельзя — сообщество осталось бы без хозяина.
        $this->assertSame(
            ['join' => false, 'leave' => false, 'manage' => true, 'post' => true, 'invite' => true],
            $data['can'],
        );
    }

    public function test_can_block_for_an_outsider_offers_only_join(): void
    {
        $community = $this->community($this->user());
        Sanctum::actingAs($this->user());

        $this->assertSame(
            ['join' => true, 'leave' => false, 'manage' => false, 'post' => false, 'invite' => false],
            $this->getJson("/api/v1/communities/{$community->slug}")->json('data.can'),
        );
    }

    public function test_can_block_for_a_plain_member(): void
    {
        $community = $this->community($this->user());
        $member = $this->joinedUser($community);
        Sanctum::actingAs($member);

        $this->assertSame(
            ['join' => false, 'leave' => true, 'manage' => false, 'post' => true, 'invite' => true],
            $this->getJson("/api/v1/communities/{$community->slug}")->json('data.can'),
        );
    }

    public function test_guest_sees_every_can_as_false(): void
    {
        $community = $this->community($this->user());

        $this->assertSame(
            ['join' => false, 'leave' => false, 'manage' => false, 'post' => false, 'invite' => false],
            $this->getJson("/api/v1/communities/{$community->slug}")->json('data.can'),
        );
    }

    /**
     * Список не должен дорожать от того, что добавили в этой ветке.
     *
     * Блок `can` — пять вызовов политики на карточку, плюс `owner`,
     * `is_favorite` и `notifications_enabled`. Спроси их ресурс сам, на
     * двадцати сообществах вышло бы под полтораста запросов вместо десятка.
     * Поэтому политика читает роль из атрибутов, создатель приходит через
     * eager load, а избранное и уведомления считаются пачкой на страницу.
     *
     * Три запроса на карточку остаются и без этих полей — их делает
     * CommunityHubService::attachActivity: счётчик непрочитанных постов,
     * список участников для аватарок и проверка поданной заявки. Это долг
     * старше ветки, поэтому порог, а не равенство: если он сдвинется вверх,
     * значит подорожал ресурс.
     */
    public function test_listing_does_not_grow_queries_beyond_the_known_cost(): void
    {
        $viewer = $this->user();
        $category = $this->communityCategory();

        foreach (range(1, 3) as $ignored) {
            $this->community($viewer, $category);
        }

        Sanctum::actingAs($viewer);
        $small = $this->countQueries(fn () => $this->getJson('/api/v1/communities?per_page=20')->assertOk());

        foreach (range(1, 9) as $ignored) {
            $this->community($viewer, $category);
        }

        $large = $this->countQueries(fn () => $this->getJson('/api/v1/communities?per_page=20')->assertOk());
        $perCommunity = ($large - $small) / 9;

        $this->assertLessThanOrEqual(
            3,
            $perCommunity,
            "на карточку приходится {$perCommunity} запросов вместо трёх известных: {$small} на трёх сообществах, {$large} на двенадцати",
        );
    }

    private function countQueries(callable $run): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();

        try {
            $run();

            return count(DB::getQueryLog());
        } finally {
            DB::disableQueryLog();
        }
    }

    // ── помощники ───────────────────────────────────────────────────────────

    private function user(): User
    {
        return User::factory()->create(['status' => UserStatus::Active]);
    }

    private function community(User $owner, ?CommunityCategory $category = null): Community
    {
        $community = Community::query()->create([
            'category_id' => ($category ?? $this->communityCategory())->id,
            'name' => 'Клуб '.Str::random(5),
            'slug' => 'club-'.Str::random(8),
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
            'access_type' => 'open',
            'members_count' => 1,
        ]);

        $community->members()->attach($owner->id, [
            'role' => CommunityMemberRole::Owner->value,
            'joined_at' => now(),
        ]);

        return $community;
    }

    private function joinedUser(Community $community): User
    {
        $user = $this->user();
        $community->members()->attach($user->id, [
            'role' => CommunityMemberRole::Member->value,
            'joined_at' => now(),
        ]);

        return $user;
    }

    private function befriend(User $a, User $b): void
    {
        DB::table('user_friendships')->insert([
            ['user_id' => $a->id, 'friend_id' => $b->id, 'created_at' => now()],
            ['user_id' => $b->id, 'friend_id' => $a->id, 'created_at' => now()],
        ]);
    }

    private function memberFlag(Community $community, User $user): ?bool
    {
        $value = DB::table('community_members')
            ->where('community_id', $community->id)
            ->where('user_id', $user->id)
            ->value('notifications_enabled');

        return $value === null ? null : (bool) $value;
    }

    private function communityCategory(): CommunityCategory
    {
        return CommunityCategory::query()->create([
            'name' => 'Категория',
            'slug' => 'cat-'.Str::random(8),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
    }

    private function postCategory(): PostCategory
    {
        $slug = 'topic-'.Str::random(6);

        return PostCategory::query()->create([
            'name' => 'Тема',
            'slug' => $slug,
            'sort_order' => 10,
            'depth' => 0,
            'path' => $slug,
            'is_active' => true,
        ]);
    }
}
