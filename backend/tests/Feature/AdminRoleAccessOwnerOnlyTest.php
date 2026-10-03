<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\RoleAccessOverrides;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Карту прав ролей правит только Владелец, и `roles` никому не выдаётся.
 *
 * Докблок контроллера обещал «Только Владелец», а в коде проверки не было:
 * единственным стражем стоял `admin.section:roles`. При этом ключ `roles`
 * переопределяется той же картой, которую ручка пишет, и настройка
 * спрашивается раньше ранга. То есть одна галочка открывала роли право
 * править саму матрицу, а оттуда — деньги и права.
 *
 * Поэтому замков два: роль на входе и запрет выдавать `roles` настройкой.
 */
class AdminRoleAccessOwnerOnlyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RoleAccessOverrides::forget();
    }

    public function test_a_moderator_cannot_write_the_map(): void
    {
        $модератор = User::factory()->create(['role' => UserRole::Moderator]);

        $this->actingAs($модератор, 'sanctum')
            ->putJson('/api/v1/admin/roles/access', ['access' => ['moderator' => ['events' => true]]])
            ->assertStatus(403);
    }

    public function test_the_owner_can_write_the_map(): void
    {
        $владелец = User::factory()->create(['role' => UserRole::Owner]);

        $this->actingAs($владелец, 'sanctum')
            ->putJson('/api/v1/admin/roles/access', ['access' => ['moderator' => ['events' => true]]])
            ->assertOk();
    }

    public function test_roles_cannot_be_granted_to_a_moderator_even_by_the_owner(): void
    {
        $владелец = User::factory()->create(['role' => UserRole::Owner]);

        $this->actingAs($владелец, 'sanctum')
            ->putJson('/api/v1/admin/roles/access', ['access' => ['moderator' => ['roles' => true]]])
            ->assertOk();

        RoleAccessOverrides::forget();

        // Настройка эту клетку не принимает: в `store` она отбрасывается.
        $this->assertNotTrue(RoleAccessOverrides::effective()['moderator']['roles'] ?? false);
    }

    public function test_a_moderator_granted_roles_through_the_map_still_cannot_write_it(): void
    {
        // Даже если клетка каким-то путём окажется открытой, второй замок —
        // проверка роли в контроллере — держит.
        RoleAccessOverrides::store(['moderator' => ['roles' => true]]);
        RoleAccessOverrides::forget();

        $модератор = User::factory()->create(['role' => UserRole::Moderator]);

        $this->actingAs($модератор, 'sanctum')
            ->putJson('/api/v1/admin/roles/access', ['access' => ['moderator' => ['monetization' => true]]])
            ->assertStatus(403);
    }
}
