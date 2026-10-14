<?php

namespace Tests\Feature;

use App\Enums\PhoneVerificationChannel;
use App\Enums\PhoneVerificationPhase;
use App\Enums\UserStatus;
use App\Models\PhoneVerificationCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MobileIdPhoneVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('sms.driver', 'log');
        Config::set('sms.verification.resend_cooldown_seconds', 0);
        Config::set('sms.iqsms.mobile_id_enabled', true);
        Config::set('sms.iqsms.webhook_secret', 'test-secret');
        Config::set('sms.iqsms.otp_code_length', 4);
    }

    public function test_send_code_returns_mobile_id_session(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $token = $user->createToken('api')->plainTextToken;

        $this->postJson('/api/v1/account/phone/send-code', [
            'phone' => '+79897625658',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertStatus(202)
            ->assertJsonPath('data.verification_mode', 'mobile_id')
            ->assertJsonPath('data.phase', 'awaiting_push')
            ->assertJsonStructure(['data' => ['session_id', 'hint', 'poll_interval_seconds']]);
    }

    public function test_otp_webhook_then_verify_with_operator_code(): void
    {
        Http::fake([
            'api.iqsms.ru/v3/otp/verify-otp' => Http::response(['status' => 'ok']),
        ]);

        $user = User::factory()->create(['status' => UserStatus::Active]);
        $token = $user->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->postJson('/api/v1/account/phone/send-code', [
            'phone' => '+79897625658',
        ], $headers)->assertStatus(202);

        $sessionId = PhoneVerificationCode::query()->where('user_id', $user->id)->value('session_id');
        $this->assertNotNull($sessionId);

        $this->postJson('/api/v1/webhooks/iqsms/mobile-id?token=test-secret', [
            'type' => 'otp_required',
            'message_id' => '999001',
            'phone' => '+79897625658',
            'otp_token' => 'otp-token-abc',
        ])->assertOk();

        $this->getJson('/api/v1/account/phone/verification-session/'.$sessionId, $headers)
            ->assertOk()
            ->assertJsonPath('data.phase', 'otp_required')
            ->assertJsonPath('data.code_length', 4);

        $this->postJson('/api/v1/account/phone/verify', [
            'phone' => '+79897625658',
            'session_id' => $sessionId,
            'code' => '9764',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.phone_verified', true);

        Http::assertSent(function ($request): bool {
            return str_contains($request->url(), 'verify-otp')
                && ($request->data()['otp_token'] ?? null) === 'otp-token-abc'
                && ($request->data()['code'] ?? null) === '9764';
        });
    }

    public function test_delivered_webhook_completes_without_code_entry(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $token = $user->createToken('api')->plainTextToken;
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->postJson('/api/v1/account/phone/send-code', [
            'phone' => '+79897625658',
        ], $headers)->assertStatus(202);

        $record = PhoneVerificationCode::query()->where('user_id', $user->id)->firstOrFail();
        $record->update(['iqsms_message_id' => '888777']);

        $this->postJson('/api/v1/webhooks/iqsms/mobile-id?token=test-secret', [
            'status' => 'delivered',
            'message_id' => '888777',
        ])->assertOk();

        $this->getJson('/api/v1/account/phone/verification-session/'.$record->session_id, $headers)
            ->assertOk()
            ->assertJsonPath('data.completed', true);

        $user->refresh();
        $this->assertSame('+79897625658', $user->phone);
        $this->assertNotNull($user->phone_verified_at);
    }
}
