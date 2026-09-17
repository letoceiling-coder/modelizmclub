<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Две роли админки по карте App\Support\AdminAccess: Владелец видит всё,
 * Модератор — контент, пользователей, объявления, доставку, модерацию,
 * заявки и категории, и получает 403 на остальное.
 */
class AdminAccessTest extends TestCase
{
    use RefreshDatabase;

    /** Маршруты разделов Модератора — по одному-два на раздел. */
    private const SHARED_GETS = [
        '/api/v1/admin/moderation/queue',
        '/api/v1/admin/reports',
        '/api/v1/admin/feedback',
        '/api/v1/admin/communities/applications',
        '/api/v1/admin/channels/applications',
        '/api/v1/admin/users',
        '/api/v1/admin/posts',
        '/api/v1/admin/listings',
        '/api/v1/admin/delivery/stats',
        '/api/v1/admin/delivery/shipments',
        '/api/v1/admin/categories/post',
    ];

    /** Маршруты Владельца: настройки, платежи, роли, лендинг, журнал. */
    private const OWNER_GETS = [
        '/api/v1/admin/dashboard',
        '/api/v1/admin/settings',
        '/api/v1/admin/payments',
        '/api/v1/admin/plans',
        '/api/v1/admin/promocodes',
        '/api/v1/admin/wallets',
        '/api/v1/admin/withdrawals',
        '/api/v1/admin/safe-deals',
        '/api/v1/admin/disputes',
        '/api/v1/admin/audit-logs',
        '/api/v1/admin/banners',
        '/api/v1/admin/landing/blocks',
        '/api/v1/admin/rule-pages',
        '/api/v1/admin/legal-pages',
        '/api/v1/admin/notifications/policy',
        '/api/v1/admin/categories/video',
        '/api/v1/admin/videos',
        '/api/v1/admin/events',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function staff(UserRole $role): User
    {
        return User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
    }

    public function test_access_endpoint_returns_the_map(): void
    {
        $this->actingAs($this->staff(UserRole::Moderator), 'sanctum')
            ->getJson('/api/v1/admin/access')
            ->assertOk()
            ->assertJsonPath('data.role', 'moderator')
            ->assertJsonPath('data.is_owner', false)
            ->assertJsonPath('data.sections', ['dashboard', 'users', 'content', 'ads', 'delivery', 'moderation', 'applications', 'feedback', 'categories']);

        $owner = $this->actingAs($this->staff(UserRole::Admin), 'sanctum')->getJson('/api/v1/admin/access')->assertOk()->json('data');
        $this->assertTrue($owner['is_owner']);
        $this->assertContains('settings', $owner['sections']);
        $this->assertContains('monetization', $owner['sections']);
        $this->assertNotContains('owner', $owner['sections']);

        $this->actingAs($this->staff(UserRole::User), 'sanctum')->getJson('/api/v1/admin/access')->assertForbidden();
    }

    public function test_moderator_sees_own_sections_and_gets_403_elsewhere(): void
    {
        $moderator = $this->staff(UserRole::Moderator);
        foreach (self::SHARED_GETS as $url) {
            $status = $this->actingAs($moderator, 'sanctum')->getJson($url)->status();
            $this->assertNotContains($status, [401, 403], "{$url} → {$status}");
        }
        foreach (self::OWNER_GETS as $url) {
            $this->actingAs($moderator, 'sanctum')->getJson($url)->assertForbidden();
        }
    }

    public function test_owner_sees_everything(): void
    {
        $owner = $this->staff(UserRole::Admin);
        foreach ([...self::SHARED_GETS, ...self::OWNER_GETS] as $url) {
            $status = $this->actingAs($owner, 'sanctum')->getJson($url)->status();
            $this->assertNotContains($status, [401, 403], "{$url} → {$status}");
        }
    }

    public function test_regular_user_is_kept_out(): void
    {
        $user = $this->staff(UserRole::User);
        foreach (['/api/v1/admin/users', '/api/v1/admin/moderation/queue', '/api/v1/admin/settings'] as $url) {
            $this->actingAs($user, 'sanctum')->getJson($url)->assertForbidden();
        }
    }

    public function test_moderator_edits_regular_users_but_not_roles_or_staff(): void
    {
        $moderator = $this->staff(UserRole::Moderator);
        $regular = $this->staff(UserRole::User);
        $owner = $this->staff(UserRole::Admin);

        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/users/{$regular->uuid}", ['status' => 'blocked'])->assertOk();
        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/users/{$regular->uuid}", ['role' => 'moderator'])->assertForbidden();
        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/users/{$regular->uuid}", ['email' => 'x'.uniqid().'@example.com'])->assertForbidden();
        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/users/{$owner->uuid}", ['status' => 'blocked'])->assertForbidden();
        $this->actingAs($moderator, 'sanctum')->postJson('/api/v1/admin/users', ['email' => 'n'.uniqid().'@example.com', 'password' => 'secret-pass-1', 'role' => 'user'])->assertForbidden();
        $this->actingAs($moderator, 'sanctum')->deleteJson("/api/v1/admin/users/{$regular->uuid}")->assertForbidden();
        $this->actingAs($moderator, 'sanctum')->postJson("/api/v1/admin/users/{$regular->uuid}/subscription", ['action' => 'grant', 'days' => 30])->assertForbidden();

        $this->assertSame(UserRole::User, $regular->fresh()->role);
        $this->assertSame(UserStatus::Active, $owner->fresh()->status);

        $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/admin/users/{$regular->uuid}", ['role' => 'moderator'])->assertOk();
        $this->assertSame(UserRole::Moderator, $regular->fresh()->role);
    }

    public function test_moderator_edits_categories_but_not_placement_prices(): void
    {
        $moderator = $this->staff(UserRole::Moderator);
        $owner = $this->staff(UserRole::Admin);
        $listing = ListingCategory::query()->create(['name' => 'Наборы', 'slug' => 'kits', 'is_active' => true, 'listing_price_cents' => 3000]);
        $post = PostCategory::query()->create(['name' => 'Наборы', 'slug' => 'kits', 'is_active' => true, 'depth' => 0, 'path' => 'kits', 'listing_category_id' => $listing->id]);

        $row = ['name' => 'Наборы моделей', 'slug' => 'kits', 'is_active' => true, 'listing_price_cents' => 3000, 'subscriber_listing_price_cents' => null];
        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/categories/post/{$post->id}", $row)->assertOk();
        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/categories/post/{$post->id}", [...$row, 'listing_price_cents' => 100])->assertForbidden();
        $this->assertSame(3000, (int) $listing->fresh()->listing_price_cents);

        $this->actingAs($owner, 'sanctum')->patchJson("/api/v1/admin/categories/post/{$post->id}", [...$row, 'listing_price_cents' => 100])->assertOk();
        $this->assertSame(100, (int) $listing->fresh()->listing_price_cents);
    }
}
