<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Тема оформления переезжает между устройствами.
 *
 * До 12.09 выбор жил только в `localStorage`, и на втором устройстве человек
 * снова получал системную тему (аудит 12.09). Значение хранится у
 * пользователя рядом с `locale`; `null` означает «не выбирал ни разу».
 */
class ThemePreferenceTest extends TestCase
{
    use RefreshDatabase;

    /** Профиль нужен: `PATCH /users/me` отвечает ресурсом профиля. */
    private function userWithProfile(array $attrs = []): User
    {
        $user = User::factory()->create($attrs);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Тема',
            'slug' => 'theme-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    public function test_preference_is_saved_and_returned(): void
    {
        $user = $this->userWithProfile();
        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/users/me', ['theme_preference' => 'dark'])->assertOk();

        $this->assertSame('dark', $user->fresh()->theme_preference);
        $this->getJson('/api/v1/auth/me')->assertJsonPath('data.theme_preference', 'dark');
    }

    public function test_unset_preference_is_null(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/auth/me')->assertJsonPath('data.theme_preference', null);
    }

    public function test_only_known_values_are_accepted(): void
    {
        $user = $this->userWithProfile();
        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/users/me', ['theme_preference' => 'purple'])
            ->assertStatus(422);

        $this->assertNull($user->fresh()->theme_preference);
    }

    public function test_preference_can_be_cleared(): void
    {
        $user = $this->userWithProfile(['theme_preference' => 'dark']);
        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/users/me', ['theme_preference' => null])->assertOk();

        $this->assertNull($user->fresh()->theme_preference);
    }
}
