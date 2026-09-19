<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\User;
use App\Support\AdminAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Роли админки по карте App\Support\AdminAccess: Владелец видит всё,
 * Модератор — контент, пользователей, объявления, доставку, модерацию,
 * заявки, категории, обзоры, уведомления и медиа, и получает 403 на
 * остальное.
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
        '/api/v1/admin/videos',
        '/api/v1/admin/media',
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
        '/api/v1/admin/events',
        '/api/v1/admin/diagnostics',
        '/api/v1/admin/icon-media',
        '/api/v1/admin/faq',
        '/api/v1/admin/communities',
    ];

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
            ->assertJsonPath('data.sections', ['dashboard', 'users', 'content', 'ads', 'delivery', 'moderation', 'applications', 'feedback', 'categories', 'reviews', 'notifications', 'media']);

        $owner = $this->actingAs($this->staff(UserRole::Owner), 'sanctum')->getJson('/api/v1/admin/access')->assertOk()->json('data');
        $this->assertTrue($owner['is_owner']);
        $this->assertContains('settings', $owner['sections']);
        $this->assertContains('monetization', $owner['sections']);
        $this->assertNotContains('owner', $owner['sections']);
        $this->assertNotContains('users.manage', $owner['sections']);
        $this->assertSame(array_keys(AdminAccess::SECTIONS), $owner['sections']);

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
        $owner = $this->staff(UserRole::Owner);
        foreach ([...self::SHARED_GETS, ...self::OWNER_GETS] as $url) {
            $status = $this->actingAs($owner, 'sanctum')->getJson($url)->status();
            $this->assertNotContains($status, [401, 403], "{$url} → {$status}");
        }
    }

    /**
     * Модератору 19.09 открыты уведомления: рассылка уходит, а политика
     * уведомлений — по-прежнему у Владельца.
     */
    public function test_moderator_broadcasts_but_does_not_edit_notification_policy(): void
    {
        $moderator = $this->staff(UserRole::Moderator);

        $status = $this->actingAs($moderator, 'sanctum')
            ->postJson('/api/v1/admin/notifications', ['title' => 'Проверка', 'body' => 'Текст', 'audience' => 'all'])
            ->status();
        $this->assertNotContains($status, [401, 403], "notifications → {$status}");

        $this->actingAs($moderator, 'sanctum')->putJson('/api/v1/admin/notifications/policy', [])->assertForbidden();
        $this->actingAs($moderator, 'sanctum')->deleteJson('/api/v1/admin/categories/video/1')->assertForbidden();
    }

    /**
     * У каждого маршрута админки — охрана с ключом, который знает карта.
     * Опечатка в ключе закрыла бы раздел для всех, включая Владельца, а
     * маршрут без охраны открылся бы любому вошедшему.
     */
    public function test_every_admin_route_is_guarded_by_a_known_section(): void
    {
        $known = AdminAccess::keys();
        $unguarded = [];
        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1/admin/') || $route->uri() === 'api/v1/admin/access') {
                continue;
            }
            $sections = array_values(array_filter(
                $route->gatherMiddleware(),
                fn ($m) => is_string($m) && str_starts_with($m, 'admin.section:'),
            ));
            if ($sections === []) {
                $unguarded[] = $route->uri();

                continue;
            }
            foreach ($sections as $m) {
                $this->assertContains(substr($m, strlen('admin.section:')), $known, $route->uri());
            }
        }
        $this->assertSame([], $unguarded);
    }

    public function test_unknown_section_key_is_closed_even_for_owner(): void
    {
        $this->assertFalse(AdminAccess::allows($this->staff(UserRole::Owner), 'owner'));
        $this->assertFalse(AdminAccess::allows($this->staff(UserRole::Owner), 'no-such-section'));
    }

    public function test_regular_user_is_kept_out(): void
    {
        $user = $this->staff(UserRole::User);
        foreach (['/api/v1/admin/users', '/api/v1/admin/moderation/queue', '/api/v1/admin/settings'] as $url) {
            $this->actingAs($user, 'sanctum')->getJson($url)->assertForbidden();
        }
    }

    /**
     * Администратор направления получит доступ к модерации своих категорий
     * отдельным этапом; до тех пор общая админка ему закрыта целиком — роль
     * не должна открыть больше, чем обещано.
     */
    public function test_category_admin_has_no_general_admin_access_yet(): void
    {
        $categoryAdmin = $this->staff(UserRole::CategoryAdmin);
        $this->assertFalse($categoryAdmin->isModerator());
        $this->assertFalse($categoryAdmin->isOwner());

        $categoryAdmin->forceFill(['phone_verified_at' => null])->save();
        $this->assertFalse($categoryAdmin->fresh()->isFullyVerified(), 'без телефона — как обычный человек');

        $this->actingAs($categoryAdmin, 'sanctum')->getJson('/api/v1/admin/access')->assertForbidden();
        foreach ([...self::SHARED_GETS, ...self::OWNER_GETS] as $url) {
            $this->actingAs($categoryAdmin, 'sanctum')->getJson($url)->assertForbidden();
        }
    }

    public function test_moderator_edits_regular_users_but_not_roles_or_staff(): void
    {
        $moderator = $this->staff(UserRole::Moderator);
        $regular = $this->staff(UserRole::User);
        $owner = $this->staff(UserRole::Owner);

        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/users/{$regular->uuid}", ['status' => 'blocked'])->assertOk();
        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/users/{$regular->uuid}", ['role' => 'moderator'])->assertForbidden();
        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/users/{$regular->uuid}", ['email' => 'x'.uniqid().'@example.com'])->assertForbidden();
        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/users/{$owner->uuid}", ['status' => 'blocked'])->assertForbidden();
        $categoryAdmin = $this->staff(UserRole::CategoryAdmin);
        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/admin/users/{$categoryAdmin->uuid}", ['status' => 'blocked'])->assertForbidden();
        $this->assertSame(UserStatus::Active, $categoryAdmin->fresh()->status);
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
        $owner = $this->staff(UserRole::Owner);
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
