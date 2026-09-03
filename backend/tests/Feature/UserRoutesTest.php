<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The public `users/{slug}` catch-all used to swallow everything that did not
 * match an explicit route. `GET /users/me` had no route of its own, fell
 * through to the profile lookup, and the uuid fallback there compared the
 * string "me" against a uuid column — PostgreSQL answers that with a 500.
 */
class UserRoutesTest extends TestCase
{
    use RefreshDatabase;

    public function test_me_without_token_is_401_not_500(): void
    {
        $this->getJson('/api/v1/users/me')->assertStatus(401);
    }

    public function test_me_with_token_returns_own_profile(): void
    {
        // User::factory() does not create a profile; the app does that at
        // registration (AuthService), so tests build it by hand.
        $user = User::factory()->create();
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Me Myself',
            'slug' => 'me-myself',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/users/me')
            ->assertOk()
            ->assertJsonPath('data.uuid', $user->uuid);
    }

    public function test_unknown_slug_is_404_not_500(): void
    {
        $this->getJson('/api/v1/users/no-such-profile-here')->assertStatus(404);
    }

    public function test_reserved_word_that_is_not_a_uuid_is_404_not_500(): void
    {
        // Anything that is not a uuid must never reach the uuid comparison.
        $this->getJson('/api/v1/users/search-but-wrong')->assertStatus(404);
    }

    public function test_slug_with_illegal_characters_never_matches_the_catch_all(): void
    {
        // Constrained by Route::pattern('slug', ...) — a 404 from the router
        // itself, before any controller runs.
        $this->getJson('/api/v1/users/bad%20slug!')->assertStatus(404);
    }
}
