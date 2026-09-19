<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FourRolesMigrationTest extends TestCase
{
    use RefreshDatabase;

    /** Роль пишется мимо модели: `admin` и `subscriber` в перечне больше нет. */
    private function userWithRawRole(string $role): int
    {
        $id = User::factory()->create()->id;
        DB::table('users')->where('id', $id)->update(['role' => $role]);

        return $id;
    }

    private function roleOf(int $id): string
    {
        return (string) DB::table('users')->where('id', $id)->value('role');
    }

    private function migration(): object
    {
        return require database_path('migrations/2026_09_19_130000_four_roles.php');
    }

    public function test_admins_become_owners_and_each_change_is_audited(): void
    {
        $a = $this->userWithRawRole('admin');
        $b = $this->userWithRawRole('admin');
        $moderator = $this->userWithRawRole('moderator');
        $user = $this->userWithRawRole('user');

        $this->migration()->up();

        $this->assertSame('owner', $this->roleOf($a));
        $this->assertSame('owner', $this->roleOf($b));
        $this->assertSame('moderator', $this->roleOf($moderator));
        $this->assertSame('user', $this->roleOf($user));

        $rows = DB::table('audit_logs')->where('action', 'system.users.role_renamed')->orderBy('auditable_id')->get();
        $this->assertSame([$a, $b], $rows->pluck('auditable_id')->map(fn ($id) => (int) $id)->all());
        $this->assertSame(['role' => 'admin'], json_decode($rows[0]->old_values, true));
        $this->assertSame(['role' => 'owner'], json_decode($rows[0]->new_values, true));
    }

    public function test_stray_subscriber_role_becomes_user(): void
    {
        $id = $this->userWithRawRole('subscriber');

        $this->migration()->up();

        $this->assertSame('user', $this->roleOf($id));
    }

    public function test_rerun_changes_nothing(): void
    {
        $this->userWithRawRole('admin');
        $this->migration()->up();
        $this->migration()->up();

        $this->assertSame(1, DB::table('audit_logs')->where('action', 'system.users.role_renamed')->count());
    }

    public function test_down_restores_admin(): void
    {
        $owner = $this->userWithRawRole('owner');
        $categoryAdmin = $this->userWithRawRole('category_admin');

        $this->migration()->down();

        $this->assertSame('admin', $this->roleOf($owner));
        $this->assertSame('user', $this->roleOf($categoryAdmin));
    }

    public function test_spatie_tables_are_gone_and_come_back_empty_on_rollback(): void
    {
        foreach (['roles', 'permissions', 'model_has_roles', 'model_has_permissions', 'role_has_permissions'] as $table) {
            $this->assertFalse(Schema::hasTable($table), $table);
        }

        $drop = require database_path('migrations/2026_09_19_130100_drop_spatie_permission_tables.php');
        $drop->down();
        $this->assertTrue(Schema::hasTable('model_has_roles'));
        $this->assertSame(0, DB::table('roles')->count());

        $drop->up();
        $this->assertFalse(Schema::hasTable('model_has_roles'));
    }

    public function test_registration_does_not_touch_spatie(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'email' => 'new-person@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'registration_track' => 'community',
            'display_name' => 'Новый человек',
            'accept_terms' => true,
            'accept_privacy' => true,
        ])->assertSuccessful();

        $this->assertSame('user', $this->roleOf((int) User::query()->where('email', 'new-person@example.com')->value('id')));
    }
}
