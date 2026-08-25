<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\NotificationPreference;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserProfile;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Services\NotificationPolicy;
use App\Support\NotificationPolicyRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Admin\Services\NotificationPolicySettingsService;
use Tests\TestCase;

class NotificationPolicyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_default_policy_allows_social_types_for_registered_users(): void
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ]);

        $this->assertTrue(NotificationPolicy::allows($user, 'comments'));
        $this->assertTrue(NotificationPolicy::allows($user, 'likes'));
        $this->assertFalse(NotificationPolicy::allows($user, 'promo'));
        $this->assertSame('registered', app(NotificationPolicy::class)->userTier($user));
    }

    public function test_min_tier_blocks_below_threshold_but_staff_passes(): void
    {
        $this->savePolicy([
            'likes' => ['min_tier' => 'subscriber'],
        ]);

        $verified = User::factory()->create(['status' => UserStatus::Active]);
        $admin = User::factory()->create([
            'status' => UserStatus::Active,
            'role' => UserRole::Admin,
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ]);

        $this->assertFalse(NotificationPolicy::allows($verified, 'likes'));
        $this->assertTrue(NotificationPolicy::allows($admin, 'likes'));
    }

    public function test_user_toggle_and_default_enabled_are_respected(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        NotificationPreference::query()->create([
            'user_id' => $user->id,
            'channel' => 'in_app',
            'type' => 'comments',
            'enabled' => false,
        ]);

        $this->assertFalse(NotificationPolicy::allows($user, 'comments'));

        $this->savePolicy([
            'likes' => ['default_enabled' => false],
        ]);

        $this->assertFalse(NotificationPolicy::allows($user, 'likes'));
    }

    public function test_cabinet_settings_expose_items_and_unverified_can_patch_toggleable_type(): void
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ]);

        $data = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/settings')
            ->assertOk()
            ->json('data');

        $this->assertSame('registered', $data['user_tier']);
        $this->assertNotEmpty($data['items']);
        $this->assertArrayHasKey('social', $data['group_labels']);
        $keys = array_column($data['items'], 'key');
        $this->assertContains('comments', $keys);
        $this->assertNotContains('report', $keys);

        $items = $this->actingAs($user, 'sanctum')
            ->patchJson('/api/v1/users/me/settings', [
                'preferences' => [
                    ['channel' => 'in_app', 'type' => 'comments', 'enabled' => false],
                ],
            ])
            ->assertOk()
            ->json('data.items');

        $comments = collect($items)->firstWhere('key', 'comments');
        $this->assertNotNull($comments);
        $this->assertFalse($comments['enabled']);

        $this->assertDatabaseHas('notification_preferences', [
            'user_id' => $user->id,
            'channel' => 'in_app',
            'type' => 'comments',
            'enabled' => false,
        ]);
    }

    public function test_patch_rejects_unknown_and_locked_types(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/v1/users/me/settings', [
                'preferences' => [
                    ['channel' => 'in_app', 'type' => 'not_a_type', 'enabled' => false],
                ],
            ])
            ->assertStatus(422);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/v1/users/me/settings', [
                'preferences' => [
                    ['channel' => 'in_app', 'type' => 'moderation', 'enabled' => false],
                ],
            ])
            ->assertStatus(422);
    }

    public function test_admin_can_persist_notification_policy(): void
    {
        $admin = User::factory()->create([
            'status' => UserStatus::Active,
            'role' => UserRole::Admin,
        ]);

        $payload = NotificationPolicyRegistry::defaultConfig();
        $payload['types']['comments']['min_tier'] = 'verified';
        $payload['types']['comments']['user_can_toggle'] = false;

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/notifications/policy', $payload)
            ->assertOk()
            ->assertJsonPath('data.config.types.comments.min_tier', 'verified')
            ->assertJsonPath('data.config.types.comments.user_can_toggle', false);

        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ]);
        $this->assertFalse(NotificationPolicy::allows($user, 'comments'));
    }

    public function test_comment_and_like_create_notifications_except_self_and_opt_out(): void
    {
        config(['feed.auto_publish' => true]);

        $author = User::factory()->create(['status' => UserStatus::Active]);
        $actor = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create(['user_id' => $author->id, 'display_name' => 'Author', 'slug' => 'author-np']);
        UserProfile::create(['user_id' => $actor->id, 'display_name' => 'Actor', 'slug' => 'actor-np']);

        $uuid = $this->publishedPostUuid($author);

        $this->actingAs($actor, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", ['body' => 'Классная сборка'])
            ->assertCreated();

        $this->assertSame(1, $this->countByType($author, 'comments'));
        $this->assertSame(0, $this->countByType($actor, 'comments'));

        $this->actingAs($actor, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/react")
            ->assertOk();
        $this->actingAs($actor, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/react")
            ->assertOk();

        $this->assertSame(1, $this->countByType($author, 'likes'));

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/react")
            ->assertOk();
        $this->assertSame(1, $this->countByType($author, 'likes'));

        NotificationPreference::query()->updateOrCreate(
            ['user_id' => $author->id, 'channel' => 'in_app', 'type' => 'comments'],
            ['enabled' => false],
        );

        $this->actingAs($actor, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/comments", ['body' => 'Второй комментарий'])
            ->assertCreated();

        $this->assertSame(1, $this->countByType($author, 'comments'));
    }

    public function test_follow_notifies_target(): void
    {
        $follower = User::factory()->create(['status' => UserStatus::Active]);
        $target = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create(['user_id' => $follower->id, 'display_name' => 'F', 'slug' => 'f-np']);
        UserProfile::create(['user_id' => $target->id, 'display_name' => 'T', 'slug' => 't-np']);

        $this->actingAs($follower, 'sanctum')
            ->postJson("/api/v1/users/{$target->id}/follow")
            ->assertOk();

        $this->assertSame(1, $this->countByType($target, 'followers'));
        $this->assertSame(0, $this->countByType($follower, 'followers'));
    }

    public function test_published_post_notifies_followers(): void
    {
        config(['feed.auto_publish' => true]);

        $author = User::factory()->create(['status' => UserStatus::Active]);
        $follower = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create(['user_id' => $author->id, 'display_name' => 'Author', 'slug' => 'author-sub-np']);
        UserProfile::create(['user_id' => $follower->id, 'display_name' => 'Fan', 'slug' => 'fan-sub-np']);

        $this->actingAs($follower, 'sanctum')
            ->postJson("/api/v1/users/{$author->id}/follow")
            ->assertOk();

        $this->publishedPostUuid($author);

        $this->assertSame(1, $this->countByType($follower, 'subscription_posts'));
        $this->assertSame(0, $this->countByType($author, 'subscription_posts'));
    }

    public function test_promo_opt_out_is_respected(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        NotificationPreference::query()->create([
            'user_id' => $user->id,
            'channel' => 'in_app',
            'type' => 'promo',
            'enabled' => false,
        ]);

        InAppNotify::send($user, new InAppNotification('promo', 'Скидка', 'Текст', '/ads'));
        InAppNotify::send($user, new InAppNotification('system', 'Рассылка', 'Текст', '/feed'));

        $this->assertSame(0, $user->fresh()->notifications()->count());
    }

    public function test_ads_consent_revoke_writes_promo_opt_out(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/consents/ads/revoke')
            ->assertOk();

        $this->assertDatabaseHas('notification_preferences', [
            'user_id' => $user->id,
            'channel' => 'in_app',
            'type' => 'promo',
            'enabled' => false,
        ]);
    }

    /**
     * @param  array<string, array<string, mixed>>  $types
     */
    private function savePolicy(array $types): void
    {
        app(NotificationPolicySettingsService::class)->update([
            'types' => $types,
        ]);
    }

    private function publishedPostUuid(User $author): string
    {
        $category = PostCategory::query()->first() ?? PostCategory::create([
            'name' => 'Aviation',
            'slug' => 'aviation-np-'.uniqid(),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $uuid = $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Пост для уведомлений',
                'body' => 'Содержимое поста.',
                'category_id' => $category->id,
            ])->json('data.uuid');

        $this->actingAs($author, 'sanctum')->postJson("/api/v1/posts/{$uuid}/publish")->assertOk();

        return $uuid;
    }

    private function countByType(User $user, string $type): int
    {
        return $user->fresh()->notifications()->where('data->type', $type)->count();
    }
}
