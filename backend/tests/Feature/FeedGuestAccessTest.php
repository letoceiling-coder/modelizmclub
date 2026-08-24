<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\FeedGuestAccessRegistry;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedGuestAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_public_payload_exposes_min_tier_and_version_two(): void
    {
        $this->getJson('/api/v1/public/feed-guest-access')
            ->assertOk()
            ->assertJsonPath('data.version', 2)
            ->assertJsonPath('data.actions.feed.filter.all.min_tier', 'guest')
            ->assertJsonPath('data.actions.feed.filter.all.allowed', true)
            ->assertJsonPath('data.actions.feed.filter.following.min_tier', 'auth')
            ->assertJsonPath('data.actions.feed.compose.open.min_tier', 'subscription')
            ->assertJsonPath('data.actions.route.feed.min_tier', 'guest')
            ->assertJsonPath('data.actions.route.reviews.min_tier', 'auth');
    }

    public function test_legacy_allowed_true_is_merged_as_guest(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => FeedGuestAccessRegistry::SETTING_KEY],
            [
                'group' => 'feed',
                'value' => [
                    'version' => 1,
                    'default_deny_mode' => 'popup',
                    'popup' => [
                        'title' => 'Нужна подписка',
                        'description' => 'Войдите и оформите подписку.',
                        'primary_cta' => 'Оформить подписку',
                        'secondary_cta' => 'Позже',
                    ],
                    'actions' => [
                        'feed.filter.following' => ['allowed' => true, 'deny_mode' => 'inherit'],
                        'feed.compose.open' => ['allowed' => false, 'deny_mode' => 'popup'],
                    ],
                ],
            ],
        );

        $this->getJson('/api/v1/public/feed-guest-access')
            ->assertOk()
            ->assertJsonPath('data.version', 2)
            ->assertJsonPath('data.actions.feed.filter.following.min_tier', 'guest')
            ->assertJsonPath('data.actions.feed.filter.following.allowed', true)
            ->assertJsonPath('data.actions.feed.compose.open.min_tier', 'subscription')
            ->assertJsonPath('data.popup.title', 'Нужна подписка');
    }

    public function test_admin_can_persist_min_tier_for_pages_and_filters(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);

        $payload = FeedGuestAccessRegistry::defaultConfig();
        $payload['actions']['route.reviews']['min_tier'] = 'guest';
        $payload['actions']['route.reviews']['allowed'] = true;
        $payload['actions']['feed.filter.following']['min_tier'] = 'subscription';
        $payload['actions']['feed.filter.following']['allowed'] = false;
        $payload['actions']['route.feed']['min_tier'] = 'auth';
        $payload['actions']['route.feed']['allowed'] = false;

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/feed/guest-access', $payload)
            ->assertOk()
            ->assertJsonPath('data.config.actions.route.reviews.min_tier', 'guest')
            ->assertJsonPath('data.config.actions.feed.filter.following.min_tier', 'subscription')
            ->assertJsonPath('data.config.actions.route.feed.min_tier', 'auth')
            ->assertJsonPath('data.registry.0.default_min_tier', 'guest');

        $this->getJson('/api/v1/public/feed-guest-access')
            ->assertOk()
            ->assertJsonPath('data.actions.route.reviews.min_tier', 'guest')
            ->assertJsonPath('data.actions.feed.filter.following.min_tier', 'subscription')
            ->assertJsonPath('data.actions.route.feed.min_tier', 'auth');
    }
}
