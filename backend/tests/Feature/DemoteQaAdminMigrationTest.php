<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DemoteQaAdminMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function runMigration(): void
    {
        $migration = require database_path('migrations/2026_09_19_120000_demote_qa_admin_to_moderator.php');
        $migration->up();
    }

    public function test_qa_admin_becomes_moderator_and_the_change_is_audited(): void
    {
        $qa = User::factory()->create(['email' => 'admin@modelizmclub.ru', 'role' => UserRole::Admin]);

        $this->runMigration();

        $this->assertSame(UserRole::Moderator, $qa->fresh()->role);
        $row = DB::table('audit_logs')->where('auditable_id', $qa->id)->where('action', 'system.users.role_demoted')->first();
        $this->assertNotNull($row);
        $this->assertSame(['role' => 'admin'], json_decode($row->old_values, true));
        $this->assertSame('moderator', json_decode($row->new_values, true)['role']);
    }

    public function test_other_admins_are_untouched(): void
    {
        $owner = User::factory()->create(['email' => 'owner@example.com', 'role' => UserRole::Admin]);

        $this->runMigration();

        $this->assertSame(UserRole::Admin, $owner->fresh()->role);
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'system.users.role_demoted')->count());
    }

    public function test_already_reassigned_qa_account_is_left_alone(): void
    {
        $qa = User::factory()->create(['email' => 'admin@modelizmclub.ru', 'role' => UserRole::User]);

        $this->runMigration();
        $this->runMigration();

        $this->assertSame(UserRole::User, $qa->fresh()->role);
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'system.users.role_demoted')->count());
    }
}
