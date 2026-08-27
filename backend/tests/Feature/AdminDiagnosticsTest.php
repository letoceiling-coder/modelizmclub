<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminDiagnosticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_guest_cannot_read_diagnostics(): void
    {
        $this->getJson('/api/v1/admin/diagnostics')->assertUnauthorized();
    }

    public function test_user_cannot_read_diagnostics(): void
    {
        $user = User::factory()->create(['role' => UserRole::User]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/admin/diagnostics')
            ->assertForbidden();
    }

    public function test_admin_diagnostics_returns_checks(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/diagnostics')
            ->assertOk()
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonStructure([
                'data' => [
                    'status',
                    'app' => ['name', 'env', 'laravel', 'php'],
                    'checks' => ['database', 'cache', 'queue'],
                    'integrations' => [
                        'billing_provider',
                        'vtb_enabled',
                        'vtb_configured',
                        'cdek_enabled',
                        'cdek_configured',
                        'sms_driver',
                        'sms_configured',
                    ],
                ],
            ]);
    }
}
