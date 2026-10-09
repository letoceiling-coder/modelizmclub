<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Публикация объявления требует и подтверждённой почты, и телефона.
 *
 * Раньше это проверяло один посредник `EnsureFullyVerified`, и тест звался
 * его именем. По решению З2 от 09.10 посредник разделён на два:
 * `verified.email` стоит там, где стоял прежний, а `verified.phone` — только
 * на публикации объявления и выводе средств. Публикация — единственное
 * место, где оба встречаются, и порядок отказов здесь важен: сперва почта,
 * потом телефон, иначе человек правит не то, о чём ему сказали.
 *
 * Имя теста теперь про поведение, а не про класс: класса с таким именем
 * больше нет, а проверяемое правило осталось.
 */
class PublishingAListingNeedsEmailAndPhoneTest extends TestCase
{
    use RefreshDatabase;

    public function test_unverified_user_cannot_create_listing(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/listings', [
            'title' => 'Test',
            'description' => 'Desc',
        ])->assertForbidden()
            ->assertJsonPath('code', 'email_not_verified');
    }

    public function test_email_verified_but_phone_unverified_cannot_create_listing(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
            'phone_verified_at' => null,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/listings', [
            'title' => 'Test',
            'description' => 'Desc',
        ])->assertForbidden()
            ->assertJsonPath('code', 'phone_not_verified');
    }

    public function test_fully_verified_user_passes_middleware(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/listings', [
            'title' => 'Test',
            'description' => 'Desc',
        ])->assertStatus(422);
    }

    public function test_admin_without_phone_verification_can_create_listing(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::Owner,
            'email_verified_at' => now(),
            'phone_verified_at' => null,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/listings', [
            'title' => 'Test',
            'description' => 'Desc',
        ])->assertStatus(422);
    }

    public function test_moderator_without_phone_verification_can_create_listing(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::Moderator,
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/listings', [
            'title' => 'Test',
            'description' => 'Desc',
        ])->assertStatus(422);
    }
}
