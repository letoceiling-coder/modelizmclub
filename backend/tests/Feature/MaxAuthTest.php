<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserOAuthAccount;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MaxAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        config([
            'services.max.bot_token' => 'test-bot-token',
            'services.max.bot_username' => 'se13448473_1_bot',
            'services.max.bot_url' => 'https://max.ru/se13448473_1_bot',
            'services.max.api_base' => 'https://platform-api2.max.ru',
            'services.max.webhook_secret' => 'TestSecret-123',
            'app.frontend_url' => 'https://modelizmclub.ru',
        ]);

        Http::fake([
            'https://platform-api2.max.ru/*' => Http::response(['success' => true], 200),
        ]);
    }

    public function test_start_returns_session_and_bot_url(): void
    {
        $response = $this->postJson('/api/v1/auth/oauth/max/start')->assertOk();

        $session = $response->json('data.session');
        $this->assertIsString($session);
        $this->assertMatchesRegularExpression('/^[a-z0-9]{16,32}$/', $session);
        $this->assertSame(
            'https://max.ru/se13448473_1_bot?start='.$session,
            $response->json('data.bot_url'),
        );

        $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'pending');
    }

    public function test_redirect_sends_browser_to_bot(): void
    {
        $response = $this->get('/api/v1/auth/oauth/max/redirect');
        $response->assertRedirect();
        $this->assertStringStartsWith('https://max.ru/se13448473_1_bot?start=', $response->headers->get('Location'));
    }

    public function test_webhook_rejects_bad_secret(): void
    {
        $this->postJson('/api/v1/webhooks/max', ['update_type' => 'bot_started'])
            ->assertUnauthorized();
    }

    public function test_confirm_creates_user_and_returns_token_once(): void
    {
        $session = $this->postJson('/api/v1/auth/oauth/max/start')->json('data.session');

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'bot_started',
                'payload' => $session,
                'user' => [
                    'user_id' => 4242,
                    'first_name' => 'Игорь',
                    'last_name' => 'К',
                    'username' => 'igor',
                ],
            ])
            ->assertOk();

        $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'awaiting_confirm');

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'message_callback',
                'callback' => [
                    'callback_id' => 'cb-1',
                    'payload' => 'ok:'.$session,
                    'user' => [
                        'user_id' => 4242,
                        'first_name' => 'Игорь',
                        'last_name' => 'К',
                        'username' => 'igor',
                    ],
                ],
            ])
            ->assertOk();

        $ready = $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'ready');

        $token = $ready->json('data.token');
        $this->assertIsString($token);
        $this->assertNotSame('', $token);

        $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'consumed');
        $this->assertNull(
            $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)->json('data.token')
        );

        $user = User::query()->where('email', 'max_4242@oauth.modelizmclub.local')->first();
        $this->assertNotNull($user);
        $this->assertNotNull($user->email_verified_at);
        $this->assertNull($user->phone_verified_at);
        $this->assertFalse($user->requiresEmailVerification());
        $this->assertTrue(
            UserOAuthAccount::query()
                ->where('user_id', $user->id)
                ->where('provider', 'max')
                ->where('provider_user_id', '4242')
                ->exists()
        );

        $this->getJson('/api/v1/auth/me', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('data.email', null)
            ->assertJsonPath('data.email_verified', true)
            ->assertJsonPath('data.oauth_providers', ['max']);
    }

    public function test_deny_marks_session_denied(): void
    {
        $session = $this->postJson('/api/v1/auth/oauth/max/start')->json('data.session');

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'message_callback',
                'callback' => [
                    'callback_id' => 'cb-deny',
                    'payload' => 'no:'.$session,
                    'user' => ['user_id' => 7, 'first_name' => 'A'],
                ],
            ])
            ->assertOk();

        $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'denied');

        $this->assertSame(0, User::query()->count());
    }

    public function test_unconfigured_max_returns_503(): void
    {
        config(['services.max.bot_token' => '']);

        $this->postJson('/api/v1/auth/oauth/max/start')
            ->assertStatus(503)
            ->assertJsonPath('provider', 'max');
    }

    public function test_sharing_contact_logs_in_with_verified_phone(): void
    {
        $session = $this->postJson('/api/v1/auth/oauth/max/start')->json('data.session');
        $vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nTEL;TYPE=cell:79991234567\r\nFN:Igor\r\nEND:VCARD\r\n";
        $hash = hash_hmac('sha256', $vcf, 'test-bot-token');

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'bot_started',
                'payload' => $session,
                'user' => [
                    'user_id' => 4242,
                    'first_name' => 'Игорь',
                    'last_name' => 'К',
                ],
            ])
            ->assertOk();

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'message_created',
                'message' => [
                    'sender' => [
                        'user_id' => 4242,
                        'first_name' => 'Игорь',
                        'last_name' => 'К',
                    ],
                    'body' => [
                        'attachments' => [[
                            'type' => 'contact',
                            'payload' => [
                                'vcf_info' => $vcf,
                                'hash' => $hash,
                            ],
                        ]],
                    ],
                ],
            ])
            ->assertOk();

        $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'ready');

        $user = User::query()->where('email', 'max_4242@oauth.modelizmclub.local')->first();
        $this->assertNotNull($user);
        $this->assertSame('+79991234567', $user->phone);
        $this->assertNotNull($user->phone_verified_at);
    }

    public function test_contact_without_valid_hash_does_not_save_phone(): void
    {
        $session = $this->postJson('/api/v1/auth/oauth/max/start')->json('data.session');

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'bot_started',
                'payload' => $session,
                'user' => ['user_id' => 77, 'first_name' => 'A'],
            ])
            ->assertOk();

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'message_created',
                'message' => [
                    'sender' => ['user_id' => 77, 'first_name' => 'A'],
                    'body' => [
                        'attachments' => [[
                            'type' => 'contact',
                            'payload' => [
                                'vcf_info' => "BEGIN:VCARD\r\nTEL;TYPE=cell:79990000000\r\nEND:VCARD\r\n",
                            ],
                        ]],
                    ],
                ],
            ])
            ->assertOk();

        $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'awaiting_confirm');
        $this->assertSame(0, User::query()->count());
    }

    public function test_request_contact_logs_in_even_if_hmac_mismatches(): void
    {
        $session = $this->postJson('/api/v1/auth/oauth/max/start')->json('data.session');

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'bot_started',
                'payload' => $session,
                'user' => ['user_id' => 91, 'first_name' => 'A'],
            ])
            ->assertOk();

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'message_created',
                'message' => [
                    'sender' => ['user_id' => 91, 'first_name' => 'A'],
                    'body' => [
                        'attachments' => [[
                            'type' => 'contact',
                            'payload' => [
                                'vcf_info' => "BEGIN:VCARD\r\nTEL;TYPE=cell:79991112233\r\nEND:VCARD\r\n",
                                'hash' => str_repeat('ab', 32),
                            ],
                        ]],
                    ],
                ],
            ])
            ->assertOk();

        $ready = $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'ready');
        $this->assertNotEmpty($ready->json('data.token'));

        $user = User::query()->where('email', 'max_91@oauth.modelizmclub.local')->first();
        $this->assertNotNull($user);
        $this->assertSame('+79991112233', $user->phone);
        $this->assertNotNull($user->phone_verified_at);
    }

    public function test_existing_max_user_can_bind_phone_without_login_session(): void
    {
        $user = User::factory()->create([
            'email' => 'max_88@oauth.modelizmclub.local',
            'phone' => null,
            'phone_verified_at' => null,
            'email_verified_at' => now(),
        ]);
        UserOAuthAccount::query()->create([
            'user_id' => $user->id,
            'provider' => 'max',
            'provider_user_id' => '88',
            'token' => [],
        ]);

        $vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nTEL;TYPE=cell:79001112233\r\nEND:VCARD\r\n";
        $hash = hash_hmac('sha256', $vcf, 'test-bot-token');

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'message_created',
                'message' => [
                    'sender' => ['user_id' => 88, 'first_name' => 'A'],
                    'body' => [
                        'attachments' => [[
                            'type' => 'contact',
                            'payload' => [
                                'vcf_info' => $vcf,
                                'hash' => $hash,
                            ],
                        ]],
                    ],
                ],
            ])
            ->assertOk();

        $user->refresh();
        $this->assertSame('+79001112233', $user->phone);
        $this->assertNotNull($user->phone_verified_at);
    }

    public function test_max_contact_logs_into_existing_account_with_same_phone(): void
    {
        $existing = User::factory()->create([
            'email' => 'owner@example.com',
            'phone' => '+79991112233',
            'phone_verified_at' => now(),
            'email_verified_at' => now(),
        ]);

        $session = $this->postJson('/api/v1/auth/oauth/max/start')->json('data.session');

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'bot_started',
                'payload' => $session,
                'user' => ['user_id' => 91, 'first_name' => 'Игорь'],
            ])
            ->assertOk();

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'message_created',
                'message' => [
                    'sender' => ['user_id' => 91, 'first_name' => 'Игорь'],
                    'body' => [
                        'attachments' => [[
                            'type' => 'contact',
                            'payload' => [
                                'vcf_info' => "BEGIN:VCARD\r\nTEL;TYPE=cell:79991112233\r\nEND:VCARD\r\n",
                                'hash' => str_repeat('ab', 32),
                            ],
                        ]],
                    ],
                ],
            ])
            ->assertOk();

        $ready = $this->getJson('/api/v1/auth/oauth/max/status?session='.$session)
            ->assertOk()
            ->assertJsonPath('data.status', 'ready');

        $token = $ready->json('data.token');
        $this->getJson('/api/v1/auth/me', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('data.email', 'owner@example.com');

        $this->assertTrue(
            UserOAuthAccount::query()
                ->where('user_id', $existing->id)
                ->where('provider', 'max')
                ->where('provider_user_id', '91')
                ->exists()
        );
        $this->assertNull(User::query()->where('email', 'max_91@oauth.modelizmclub.local')->first());
    }
}
