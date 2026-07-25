<?php

namespace Tests\Feature;

use App\Models\PhoneVerificationCode;
use App\Models\User;
use App\Enums\UserStatus;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class PhoneVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Config::set('sms.driver', 'log');
        Config::set('sms.verification.resend_cooldown_seconds', 0);
    }

    public function test_authenticated_user_can_verify_phone_with_sms_code(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $token = $user->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->postJson('/api/v1/account/phone/send-code', [
            'phone' => '8 (989) 762-56-58',
        ], $headers)
            ->assertStatus(202)
            ->assertJsonPath('data.message', 'Код отправлен по SMS.');

        $code = PhoneVerificationCode::query()
            ->where('user_id', $user->id)
            ->value('code');

        $this->assertNotNull($code);

        $this->postJson('/api/v1/account/phone/verify', [
            'phone' => '+79897625658',
            'code' => $code,
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.phone', '+79897625658')
            ->assertJsonPath('data.phone_verified', true);

        $user->refresh();
        $this->assertSame('+79897625658', $user->phone);
        $this->assertNotNull($user->phone_verified_at);
    }

    public function test_send_code_rejects_invalid_phone(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $token = $user->createToken('api')->plainTextToken;

        $this->postJson('/api/v1/account/phone/send-code', [
            'phone' => '123',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    public function test_verify_rejects_wrong_code(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $token = $user->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->postJson('/api/v1/account/phone/send-code', [
            'phone' => '+79897625658',
        ], $headers)->assertStatus(202);

        $this->postJson('/api/v1/account/phone/verify', [
            'phone' => '+79897625658',
            'code' => '000000',
        ], $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }
}
