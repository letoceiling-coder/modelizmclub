<?php

namespace Tests\Feature;

use App\Models\EmailVerificationCode;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_register_verify_login_and_me_flow(): void
    {
        $register = $this->postJson('/api/v1/auth/register', [
            'email' => 'user@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'registration_track' => 'community',
            'display_name' => 'Test User',
        ]);

        $register->assertCreated()
            ->assertJsonPath('data.message', 'Код подтверждения отправлен на email.');

        $code = EmailVerificationCode::query()->whereHas('user', fn ($q) => $q->where('email', 'user@example.com'))->value('code');
        $this->assertNotNull($code);

        $verify = $this->postJson('/api/v1/auth/verify-email', [
            'email' => 'user@example.com',
            'code' => $code,
        ]);

        $verify->assertOk()
            ->assertJsonPath('data.email', 'user@example.com')
            ->assertJsonPath('data.profile.slug', 'test-user')
            ->assertJsonStructure(['meta' => ['token', 'token_type']]);

        $token = $verify->json('meta.token');

        $this->getJson('/api/v1/auth/me', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('data.email', 'user@example.com');

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'user@example.com',
            'password' => 'password123',
        ]);

        $login->assertOk()->assertJsonStructure(['meta' => ['token']]);

        $this->postJson('/api/v1/auth/logout', [], ['Authorization' => 'Bearer '.$token])
            ->assertOk();
    }

    public function test_consent_requires_authentication(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->postJson('/api/v1/auth/consent', [
            'document_version' => 'privacy-2026-06',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertCreated()
            ->assertJsonPath('data.document_version', 'privacy-2026-06');
    }
}
