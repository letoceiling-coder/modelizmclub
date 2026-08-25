<?php

namespace Tests\Feature;

use App\Models\NotificationPreference;
use App\Models\User;
use App\Models\UserOAuthAccount;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Modules\Auth\Services\MaxNotificationService;
use Tests\TestCase;

class MaxLinkTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        config([
            'services.max.bot_token' => 'test-bot-token',
            'services.max.bot_username' => 'id2312341754_bot',
            'services.max.api_base' => 'https://platform-api2.max.ru',
            'services.max.webhook_secret' => 'TestSecret-123',
            'app.frontend_url' => 'https://modelizmclub.ru',
        ]);

        Http::fake([
            'https://platform-api2.max.ru/*' => Http::response(['success' => true], 200),
        ]);
    }

    public function test_guest_cannot_start_link(): void
    {
        $this->postJson('/api/v1/auth/oauth/max/link')->assertUnauthorized();
    }

    public function test_link_attaches_max_to_current_user(): void
    {
        $user = User::factory()->create();

        $session = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/oauth/max/link')
            ->assertOk()
            ->json('data.session');

        $this->confirmLink($session, 9001);

        $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'ready');

        $this->assertTrue(
            UserOAuthAccount::query()
                ->where('user_id', $user->id)
                ->where('provider', 'max')
                ->where('provider_user_id', '9001')
                ->exists()
        );
        $this->assertTrue(
            NotificationPreference::query()
                ->where('user_id', $user->id)
                ->where('channel', MaxNotificationService::CHANNEL)
                ->where('type', MaxNotificationService::MASTER_TYPE)
                ->where('enabled', true)
                ->exists()
        );
        $this->assertSame(1, User::query()->count());

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.oauth_providers', ['max']);
    }

    public function test_link_conflict_does_not_steal_another_account(): void
    {
        $owner = User::factory()->create();
        UserOAuthAccount::query()->create([
            'user_id' => $owner->id,
            'provider' => 'max',
            'provider_user_id' => '4242',
            'token' => [],
        ]);
        $other = User::factory()->create();

        $session = $this->actingAs($other, 'sanctum')
            ->postJson('/api/v1/auth/oauth/max/link')
            ->assertOk()
            ->json('data.session');

        $this->confirmLink($session, 4242);

        $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'conflict');

        $this->assertTrue(
            UserOAuthAccount::query()
                ->where('user_id', $owner->id)
                ->where('provider', 'max')
                ->where('provider_user_id', '4242')
                ->exists()
        );
        $this->assertFalse(
            UserOAuthAccount::query()->where('user_id', $other->id)->where('provider', 'max')->exists()
        );
    }

    public function test_link_replaces_previous_max_on_same_user(): void
    {
        $user = User::factory()->create();
        UserOAuthAccount::query()->create([
            'user_id' => $user->id,
            'provider' => 'max',
            'provider_user_id' => '1',
            'token' => [],
        ]);

        $session = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/oauth/max/link')
            ->assertOk()
            ->json('data.session');

        $this->confirmLink($session, 2);

        $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'ready');

        $this->assertFalse(
            UserOAuthAccount::query()->where('user_id', $user->id)->where('provider_user_id', '1')->exists()
        );
        $this->assertTrue(
            UserOAuthAccount::query()
                ->where('user_id', $user->id)
                ->where('provider', 'max')
                ->where('provider_user_id', '2')
                ->exists()
        );
    }

    public function test_unlink_removes_max_when_email_exists(): void
    {
        $user = User::factory()->create();
        UserOAuthAccount::query()->create([
            'user_id' => $user->id,
            'provider' => 'max',
            'provider_user_id' => '88',
            'token' => [],
        ]);

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/v1/auth/oauth/max')
            ->assertOk()
            ->assertJsonPath('data.oauth_providers', []);

        $this->assertFalse($user->fresh()->hasOAuthProvider('max'));
        $this->assertFalse(
            NotificationPreference::query()
                ->where('user_id', $user->id)
                ->where('channel', MaxNotificationService::CHANNEL)
                ->where('enabled', true)
                ->exists()
        );
    }

    public function test_unlink_blocked_when_max_is_only_login(): void
    {
        $user = User::factory()->create([
            'email' => 'max_91@oauth.modelizmclub.local',
            'email_verified_at' => now(),
        ]);
        UserOAuthAccount::query()->create([
            'user_id' => $user->id,
            'provider' => 'max',
            'provider_user_id' => '91',
            'token' => [],
        ]);

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/v1/auth/oauth/max')
            ->assertStatus(422);

        $this->assertTrue($user->fresh()->hasOAuthProvider('max'));
    }

    public function test_master_toggle_off_skips_max_send(): void
    {
        $user = User::factory()->create();
        UserOAuthAccount::query()->create([
            'user_id' => $user->id,
            'provider' => 'max',
            'provider_user_id' => '33',
            'token' => [],
        ]);
        NotificationPreference::query()->create([
            'user_id' => $user->id,
            'channel' => MaxNotificationService::CHANNEL,
            'type' => MaxNotificationService::MASTER_TYPE,
            'enabled' => false,
        ]);

        InAppNotify::send($user, new InAppNotification('system', 'Hi', 'Body'));

        Http::assertNothingSent();
    }

    public function test_disabled_in_app_type_is_not_mirrored_to_max(): void
    {
        $user = User::factory()->create();
        UserOAuthAccount::query()->create([
            'user_id' => $user->id,
            'provider' => 'max',
            'provider_user_id' => '44',
            'token' => [],
        ]);
        NotificationPreference::query()->create([
            'user_id' => $user->id,
            'channel' => 'in_app',
            'type' => 'friend_requests',
            'enabled' => false,
        ]);

        InAppNotify::send(
            $user,
            new InAppNotification('friend_request', 'Заявка', 'Тело', '/friends'),
        );

        Http::assertNothingSent();
    }

    private function confirmLink(string $session, int $maxUserId): void
    {
        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'bot_started',
                'payload' => $session,
                'user' => ['user_id' => $maxUserId, 'first_name' => 'A'],
            ])
            ->assertOk();

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'message_callback',
                'callback' => [
                    'callback_id' => 'cb-link-'.$maxUserId,
                    'payload' => 'ok:'.$session,
                    'user' => ['user_id' => $maxUserId, 'first_name' => 'A'],
                ],
            ])
            ->assertOk();
    }
}
