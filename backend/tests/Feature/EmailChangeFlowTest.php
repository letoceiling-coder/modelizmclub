<?php

namespace Tests\Feature;

use App\Models\PendingEmailChange;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Смена email доходит до конца.
 *
 * Сервер умел всё и раньше: `change-email` кладёт адрес в ожидание и шлёт на
 * него код, `confirm-email` подтверждает. Не хватало одного — наружу
 * незавершённая смена не отдавалась, и страница настроек после перезагрузки
 * не знала, что смена начата: показывала прежний адрес и не давала ввести код
 * (найдено 12.09). Здесь закреплены обе половины: адрес до подтверждения не
 * меняется, а `pending_email` виден владельцу.
 */
class EmailChangeFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_change_request_does_not_touch_the_account_email(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/account/change-email', ['new_email' => 'new@example.com'])
            ->assertStatus(202)
            ->assertJson(['pending' => true]);

        $this->assertSame('old@example.com', $user->fresh()->email);
        $this->assertSame(
            'new@example.com',
            PendingEmailChange::query()->where('user_id', $user->id)->value('new_email'),
        );
    }

    public function test_pending_email_is_visible_to_its_owner(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/account/change-email', ['new_email' => 'new@example.com']);

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.pending_email', 'new@example.com')
            ->assertJsonPath('data.email', 'old@example.com');
    }

    public function test_no_pending_email_when_nothing_is_started(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com']);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.pending_email', null);
    }

    public function test_expired_request_is_not_reported_as_pending(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com']);
        Sanctum::actingAs($user);

        PendingEmailChange::query()->create([
            'user_id' => $user->id,
            'new_email' => 'new@example.com',
            'code_hash' => bcrypt('123456'),
            'expires_at' => now()->subMinute(),
        ]);

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.pending_email', null);
    }

    public function test_wrong_code_leaves_the_address_alone(): void
    {
        $user = User::factory()->create(['email' => 'old@example.com']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/account/change-email', ['new_email' => 'new@example.com']);

        $this->postJson('/api/v1/account/confirm-email', ['code' => '000000'])
            ->assertStatus(422);

        $this->assertSame('old@example.com', $user->fresh()->email);
    }
}
