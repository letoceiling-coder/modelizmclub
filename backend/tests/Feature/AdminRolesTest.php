<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PostCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Services\CategoryAdminService;
use Tests\TestCase;

/**
 * Раздел «Роли и доступ» (решение 19.09): сводка сотрудников с льготами и
 * направлениями, что открывает каждая роль, предел администраторов на
 * направление. Только Владелец.
 */
class AdminRolesTest extends TestCase
{
    use RefreshDatabase;

    private function person(UserRole $role = UserRole::User, string $name = 'Человек'): User
    {
        $user = User::factory()->create(['role' => $role, 'status' => UserStatus::Active, 'name' => $name]);
        UserProfile::query()->create(['user_id' => $user->id, 'display_name' => $name, 'slug' => 'p-'.uniqid()]);

        return $user;
    }

    public function test_only_the_owner_opens_the_section(): void
    {
        $this->actingAs($this->person(UserRole::Moderator), 'sanctum')->getJson('/api/v1/admin/roles')->assertForbidden();
        $this->actingAs($this->person(UserRole::CategoryAdmin), 'sanctum')->getJson('/api/v1/admin/roles')->assertForbidden();
        $this->actingAs($this->person(UserRole::Moderator), 'sanctum')->putJson('/api/v1/admin/roles/category-admin-limit', ['value' => 3])->assertForbidden();

        $sections = $this->actingAs($this->person(UserRole::Owner), 'sanctum')->getJson('/api/v1/admin/access')->json('data.sections');
        $this->assertContains('roles', $sections);
    }

    public function test_overview_lists_staff_with_privileges_directions_and_role_map(): void
    {
        $owner = $this->person(UserRole::Owner, 'Дмитрий');
        $moderator = $this->person(UserRole::Moderator, 'Никита');
        $father = $this->person(UserRole::CategoryAdmin, 'Отец');
        $father->forceFill(['free_listings_unlimited' => true])->save();
        $this->person(UserRole::User, 'Посторонний');

        $category = PostCategory::query()->create(['name' => 'Нумизматика', 'slug' => 'numismatics', 'is_active' => true]);
        DB::table('category_admins')->insert(['user_id' => $father->id, 'post_category_id' => $category->id, 'created_at' => now(), 'updated_at' => now()]);

        $data = $this->actingAs($owner, 'sanctum')->getJson('/api/v1/admin/roles')->assertOk()->json('data');

        $this->assertSame(['owner', 'moderator', 'category_admin'], array_column($data['staff'], 'role'));
        $this->assertSame(['Дмитрий', 'Никита', 'Отец'], array_column($data['staff'], 'name'));

        $fatherRow = $data['staff'][2];
        $this->assertTrue($fatherRow['subscription_exempt']);
        $this->assertTrue($fatherRow['free_listings_unlimited']);
        $this->assertSame([['id' => $category->id, 'name' => 'Нумизматика', 'slug' => 'numismatics']], $fatherRow['categories']);

        $byRole = collect($data['roles'])->keyBy('role');
        $this->assertContains('roles', $byRole['owner']['sections']);
        $this->assertNotContains('roles', $byRole['moderator']['sections']);
        $this->assertSame(['content', 'ads', 'moderation'], $byRole['category_admin']['sections']);
        $this->assertSame([], $byRole['user']['sections']);
        $this->assertSame(10, $byRole['category_admin']['defaults']['free_listings_quota']);
        $this->assertSame(10, $data['max_per_category']);
        $this->assertSame('owner', $data['section_levels']['roles']);
    }

    public function test_owner_changes_the_threshold_and_it_applies(): void
    {
        $owner = $this->person(UserRole::Owner);

        $this->actingAs($owner, 'sanctum')->putJson('/api/v1/admin/roles/category-admin-limit', ['value' => 0])->assertStatus(422);
        $this->actingAs($owner, 'sanctum')
            ->putJson('/api/v1/admin/roles/category-admin-limit', ['value' => 3])
            ->assertOk()
            ->assertJsonPath('data.max_per_category', 3);

        $this->assertSame(3, CategoryAdminService::maxPerCategory());
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'admin.roles.category_admin_limit')->count());

        // Предел действует: четвёртого на то же направление не назначить.
        $this->actingAs($owner, 'sanctum')->putJson('/api/v1/admin/roles/category-admin-limit', ['value' => 1])->assertOk();
        $category = PostCategory::query()->create(['name' => 'Авиация', 'slug' => 'aviation', 'is_active' => true]);
        $first = $this->person(UserRole::CategoryAdmin);
        $second = $this->person(UserRole::CategoryAdmin);
        $this->actingAs($owner, 'sanctum')->putJson("/api/v1/admin/users/{$first->uuid}/categories", ['category_ids' => [$category->id]])->assertOk();
        $this->actingAs($owner, 'sanctum')->putJson("/api/v1/admin/users/{$second->uuid}/categories", ['category_ids' => [$category->id]])->assertStatus(422);
    }

    public function test_user_search_finds_by_name_email_and_display_name(): void
    {
        $owner = $this->person(UserRole::Owner);
        $target = $this->person(UserRole::User, 'Иван Коллекционер');
        $target->forceFill(['email' => 'coins@example.com'])->save();

        foreach (['Коллекц', 'coins@', 'коллекционер'] as $q) {
            $uuids = collect($this->actingAs($owner, 'sanctum')->getJson('/api/v1/admin/users?q='.urlencode($q))->assertOk()->json('data'))
                ->pluck('uuid')->all();
            $this->assertContains($target->uuid, $uuids, $q);
        }

        // Спецсимволы LIKE не становятся шаблоном.
        $this->assertSame([], $this->actingAs($owner, 'sanctum')->getJson('/api/v1/admin/users?q='.urlencode('%%'))->json('data'));
    }
}
