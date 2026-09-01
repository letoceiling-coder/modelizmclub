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
        $data = $this->getJson('/api/v1/public/feed-guest-access')
            ->assertOk()
            ->json('data');

        $this->assertSame(2, $data['version']);
        $this->assertSame('guest', $this->action($data, 'feed.filter.all')['min_tier']);
        $this->assertTrue($this->action($data, 'feed.filter.all')['allowed']);
        $this->assertSame('auth', $this->action($data, 'feed.filter.following')['min_tier']);
        $this->assertSame('subscription', $this->action($data, 'feed.compose.open')['min_tier']);
        $this->assertSame('guest', $this->action($data, 'route.feed')['min_tier']);
        $this->assertSame('auth', $this->action($data, 'route.reviews')['min_tier']);
        $this->assertSame('auth', $this->action($data, 'ads.write_seller')['min_tier']);
        $this->assertSame('auth', $this->action($data, 'ads.seller.profile')['min_tier']);
        $this->assertSame('auth', $this->action($data, 'feed.post.author')['min_tier']);
        $this->assertSame('auth', $this->action($data, 'layout.header.search')['min_tier']);
        $this->assertSame('auth', $this->action($data, 'messenger.send')['min_tier']);
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

        $data = $this->getJson('/api/v1/public/feed-guest-access')
            ->assertOk()
            ->json('data');

        $this->assertSame(2, $data['version']);
        $this->assertSame('guest', $this->action($data, 'feed.filter.following')['min_tier']);
        $this->assertTrue($this->action($data, 'feed.filter.following')['allowed']);
        $this->assertSame('subscription', $this->action($data, 'feed.compose.open')['min_tier']);
        $this->assertSame('Нужна подписка', $data['popup']['title']);
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

        $adminPayload = $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/feed/guest-access', $payload)
            ->assertOk()
            ->json('data');

        $this->assertSame('guest', $this->action($adminPayload['config'], 'route.reviews')['min_tier']);
        $this->assertSame('subscription', $this->action($adminPayload['config'], 'feed.filter.following')['min_tier']);
        $this->assertSame('auth', $this->action($adminPayload['config'], 'route.feed')['min_tier']);
        $this->assertSame('guest', $adminPayload['registry'][0]['default_min_tier']);

        $this->app['auth']->forgetGuards();

        $public = $this->getJson('/api/v1/public/feed-guest-access')
            ->assertOk()
            ->json('data');

        $this->assertSame('guest', $this->action($public, 'route.reviews')['min_tier']);
        $this->assertSame('subscription', $this->action($public, 'feed.filter.following')['min_tier']);
        $this->assertSame('auth', $this->action($public, 'route.feed')['min_tier']);
    }

    public function test_admin_rejects_invalid_min_tier(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);

        $payload = FeedGuestAccessRegistry::defaultConfig();
        $payload['actions']['route.feed']['min_tier'] = 'vip';

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/feed/guest-access', $payload)
            ->assertStatus(422);
    }

    /** @return array{min_tier: string, allowed: bool, deny_mode: string} */
    private function action(array $payload, string $key): array
    {
        $this->assertArrayHasKey('actions', $payload);
        $this->assertArrayHasKey($key, $payload['actions'], "Missing guest-access action {$key}");

        return $payload['actions'][$key];
    }
}
