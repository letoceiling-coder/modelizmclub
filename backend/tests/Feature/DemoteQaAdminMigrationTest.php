<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DemoteQaAdminMigrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Миграция работает с базой до перехода на четыре роли, где ещё есть
     * `admin`. В перечне ролей его больше нет, поэтому роль пишется и
     * читается мимо модели.
     */
    private function userWithRawRole(string $email, string $role, string $status = 'active'): int
    {
        $id = User::factory()->create(['email' => $email, 'status' => $status])->id;
        DB::table('users')->where('id', $id)->update(['role' => $role]);

        return $id;
    }

    private function roleOf(int $id): string
    {
        return (string) DB::table('users')->where('id', $id)->value('role');
    }

    private function runMigration(): void
    {
        $migration = require database_path('migrations/2026_09_19_120000_demote_qa_admin_to_moderator.php');
        $migration->up();
    }

    public function test_qa_admin_becomes_moderator_and_the_change_is_audited(): void
    {
        $this->userWithRawRole('owner@example.com', 'admin');
        $qa = $this->userWithRawRole('admin@modelizmclub.ru', 'admin');

        $this->runMigration();
        $this->runMigration();

        $this->assertSame('moderator', $this->roleOf($qa));
        $row = DB::table('audit_logs')->where('auditable_id', $qa)->where('action', 'system.users.role_demoted')->first();
        $this->assertNotNull($row);
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'system.users.role_demoted')->count());
        $this->assertSame(['role' => 'admin'], json_decode($row->old_values, true));
        $this->assertSame('moderator', json_decode($row->new_values, true)['role']);
    }

    public function test_other_admins_are_untouched(): void
    {
        $owner = $this->userWithRawRole('owner@example.com', 'admin');

        $this->runMigration();

        $this->assertSame('admin', $this->roleOf($owner));
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'system.users.role_demoted')->count());
    }

    public function test_last_active_admin_is_not_demoted(): void
    {
        $this->userWithRawRole('blocked@example.com', 'admin', 'blocked');
        $qa = $this->userWithRawRole('admin@modelizmclub.ru', 'admin');

        $this->runMigration();

        $this->assertSame('admin', $this->roleOf($qa));
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'system.users.role_demoted')->count());
    }

    public function test_already_reassigned_qa_account_is_left_alone(): void
    {
        $qa = $this->userWithRawRole('admin@modelizmclub.ru', 'user');

        $this->runMigration();
        $this->runMigration();

        $this->assertSame('user', $this->roleOf($qa));
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'system.users.role_demoted')->count());
    }
}
