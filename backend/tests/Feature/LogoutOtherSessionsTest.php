<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * «Выйти на других устройствах» отчитывается тем, что сделал.
 *
 * Раньше служба молча выходила, если текущего токена нет, а контроллер в обоих
 * случаях отвечал `ok` — страница показывала «Другие сеансы завершены», хотя
 * сервер не тронул ничего (аудит 12.09). Теперь ответ несёт число завершённых
 * сеансов, и интерфейс говорит по нему.
 */
class LogoutOtherSessionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_reports_how_many_sessions_were_ended(): void
    {
        $user = User::factory()->create();
        $user->createToken('phone');
        $user->createToken('tablet');
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/auth/logout-others')
            ->assertOk()
            ->assertJsonPath('ended_sessions', 2);
    }

    public function test_reports_zero_when_there_was_nothing_to_end(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/auth/logout-others')
            ->assertOk()
            ->assertJsonPath('ended_sessions', 0);
    }

    public function test_current_session_survives(): void
    {
        $user = User::factory()->create();
        $user->createToken('phone');
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/auth/logout-others')->assertOk();

        // Текущий сеанс остаётся рабочим: следующий запрос проходит.
        $this->getJson('/api/v1/auth/me')->assertOk();
    }
}
