<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use App\Models\UserOAuthAccount;
use App\Models\UserProfile;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Modules\Auth\Services\OAuthService;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OAuthVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_vk_oauth_user_skips_email_verification_middleware(): void
    {
        $user = User::factory()->create([
            'email' => 'vk_12345@oauth.modelizmclub.local',
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ]);
        UserOAuthAccount::create([
            'user_id' => $user->id,
            'provider' => 'vk',
            'provider_user_id' => '12345',
            'token' => [],
        ]);

        $this->assertFalse($user->requiresEmailVerification());

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/listings', [
            'title' => 'Test',
            'description' => 'Desc',
        ])->assertForbidden()
            ->assertJsonPath('code', 'phone_not_verified');
    }

    public function test_vk_oauth_new_user_is_email_verified_without_real_email(): void
    {
        $social = $this->fakeSocialUser('999', null, 'VK Person');

        $result = app(OAuthService::class)->resolveUser('vk', $social);

        $user = $result['user']->fresh(['oauthAccounts']);
        $this->assertSame('vk_999@oauth.modelizmclub.local', $user->email);
        $this->assertNotNull($user->email_verified_at);
        $this->assertFalse($user->requiresEmailVerification());
        $this->assertTrue($user->hasOAuthProvider('vk'));
    }

    public function test_yandex_oauth_auto_verifies_email_on_create(): void
    {
        $social = $this->fakeSocialUser('555', 'person@yandex.ru', 'Yandex Person');

        $result = app(OAuthService::class)->resolveUser('yandex', $social);

        $user = $result['user']->fresh(['oauthAccounts']);
        $this->assertSame('person@yandex.ru', $user->email);
        $this->assertNotNull($user->email_verified_at);
        $this->assertFalse($user->requiresEmailVerification());
    }

    public function test_yandex_oauth_links_existing_account_by_email_and_verifies(): void
    {
        $existing = User::factory()->create([
            'email' => 'existing@yandex.ru',
            'email_verified_at' => null,
            'status' => UserStatus::Active,
        ]);
        UserProfile::create([
            'user_id' => $existing->id,
            'display_name' => 'Existing',
            'slug' => 'existing',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        $social = $this->fakeSocialUser('777', 'existing@yandex.ru', 'Existing');

        $result = app(OAuthService::class)->resolveUser('yandex', $social);

        $this->assertSame($existing->id, $result['user']->id);
        $this->assertNotNull($result['user']->fresh()->email_verified_at);
        $this->assertTrue(
            UserOAuthAccount::query()
                ->where('user_id', $existing->id)
                ->where('provider', 'yandex')
                ->exists()
        );
    }

    public function test_me_endpoint_marks_vk_user_email_verified(): void
    {
        $user = User::factory()->create([
            'email' => 'vk_42@oauth.modelizmclub.local',
            'email_verified_at' => null,
            'status' => UserStatus::Active,
        ]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'VK',
            'slug' => 'vk-me',
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);
        UserOAuthAccount::create([
            'user_id' => $user->id,
            'provider' => 'vk',
            'provider_user_id' => '42',
            'token' => [],
        ]);

        $token = $user->createToken('api')->plainTextToken;

        $this->getJson('/api/v1/auth/me', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('data.email', null)
            ->assertJsonPath('data.email_verified', true)
            ->assertJsonPath('data.oauth_providers', ['vk']);
    }

    private function fakeSocialUser(string $id, ?string $email, string $name): SocialiteUser
    {
        return new class($id, $email, $name) implements SocialiteUser
        {
            public function __construct(
                private readonly string $id,
                private readonly ?string $email,
                private readonly string $name,
            ) {}

            public function getId()
            {
                return $this->id;
            }

            public function getNickname()
            {
                return null;
            }

            public function getName()
            {
                return $this->name;
            }

            public function getEmail()
            {
                return $this->email;
            }

            public function getAvatar()
            {
                return null;
            }

            public function getRaw()
            {
                return [];
            }

            public function setRaw($user)
            {
                return $this;
            }

            public function map(array $attributes)
            {
                return $this;
            }
        };
    }
}
