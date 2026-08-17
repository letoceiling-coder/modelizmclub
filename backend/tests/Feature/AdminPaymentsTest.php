<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminPaymentsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_admin_can_list_payments_with_type(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $user = User::factory()->create(['status' => UserStatus::Active]);

        Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => 9900,
            'currency' => 'RUB',
            'status' => 'paid',
            'provider' => 'stub',
            'paid_at' => now(),
            'metadata' => ['payable_type' => 'subscription', 'plan_slug' => 'month', 'plan_id' => 1],
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/payments')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'subscription')
            ->assertJsonPath('data.0.amount_rub', 99);
    }

    public function test_admin_can_export_payments_csv(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $user = User::factory()->create(['status' => UserStatus::Active, 'email' => 'payer@example.com']);

        Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => 5000,
            'currency' => 'RUB',
            'status' => 'paid',
            'provider' => 'stub',
            'paid_at' => now(),
            'metadata' => ['payable_type' => 'listing_placement'],
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->get('/api/v1/admin/payments/export');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('Размещение объявления', $response->streamedContent());
    }

    public function test_moderator_cannot_access_payments(): void
    {
        $moderator = User::factory()->create(['role' => UserRole::Moderator, 'status' => UserStatus::Active]);

        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/payments')
            ->assertForbidden();
    }
}
