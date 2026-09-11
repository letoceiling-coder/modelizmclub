<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * История просмотров принимает те же типы, что пишет фронт. До 11.09
 * правило не знало `community`, и каждый заход вошедшего в сообщество
 * отвечал 422 — посещения сообществ в историю не попадали.
 */
class ViewHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_community_view_is_recorded_and_listed(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $id = (string) Str::uuid();

        $this->postJson('/api/v1/me/view-history', [
            'id' => $id,
            'kind' => 'community',
            'title' => 'Клуб моделистов',
        ])->assertOk();

        $this->getJson('/api/v1/me/view-history')
            ->assertOk()
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.kind', 'community');
    }

    public function test_unknown_kind_is_still_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/me/view-history', [
            'id' => (string) Str::uuid(),
            'kind' => 'planet',
        ])->assertStatus(422)->assertJsonValidationErrors('kind');
    }
}
