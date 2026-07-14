<?php

namespace Tests\Feature;

use App\Enums\MediaStatus;
use App\Enums\UserStatus;
use App\Models\Media;
use App\Models\SavedPaymentMethod;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserTwoFactor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Account\Services\TwoFactorService;
use Tests\TestCase;

class BackendCompletenessTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Seller',
            'slug' => 'seller-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    public function test_stub_card_binding_flow(): void
    {
        config(['billing.provider' => 'stub']);
        $user = $this->seedUser();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/account/payment-methods')
            ->assertCreated()
            ->assertJsonStructure(['data' => ['binding_url']]);

        $bindingUrl = (string) $response->json('data.binding_url');
        $this->assertStringContainsString('/account/payment-methods/bind/complete?token=', $bindingUrl);

        parse_str((string) parse_url($bindingUrl, PHP_URL_QUERY), $query);
        $token = (string) ($query['token'] ?? '');
        $this->assertNotSame('', $token);

        $this->get('/api/v1/account/payment-methods/bind/complete?token='.$token)
            ->assertRedirect();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/account/payment-methods')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.last4', '4242');

        $this->assertSame(1, SavedPaymentMethod::query()->where('user_id', $user->id)->count());
    }

    public function test_listing_placement_payment_grants_credit(): void
    {
        config(['billing.provider' => 'stub']);
        $user = $this->seedUser();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['payable_type' => 'listing_placement'])
            ->assertCreated()
            ->assertJsonPath('data.provider', 'stub');

        $uuid = $response->json('data.payment_uuid');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/payments/{$uuid}/confirm-stub")
            ->assertOk();

        $this->assertSame(1, $user->fresh()->listing_placement_credits);
    }

    public function test_two_factor_setup_verify_and_disable(): void
    {
        $user = $this->seedUser();
        $twoFactor = app(TwoFactorService::class);

        $setup = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/account/2fa/setup')
            ->assertOk()
            ->json('data');

        $secret = (string) ($setup['secret'] ?? '');
        $this->assertNotSame('', $secret);
        $this->assertStringStartsWith('otpauth://totp/', (string) ($setup['otpauth_url'] ?? ''));

        $code = $this->totpCode($twoFactor, $secret);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/account/2fa/verify', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertTrue(
            UserTwoFactor::query()->where('user_id', $user->id)->value('enabled')
        );

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/account/2fa/disable', ['code' => $code])
            ->assertOk();

        $this->assertNull(UserTwoFactor::query()->where('user_id', $user->id)->first());
    }

    public function test_transcription_stub_returns_text(): void
    {
        config(['media.transcription.stub' => true]);
        $user = $this->seedUser();

        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'uploaded_by' => $user->id,
            'disk' => 'local',
            'path' => 'tmp/voice/smoke/test.ogg',
            'filename' => 'test.ogg',
            'mime_type' => 'audio/ogg',
            'size_bytes' => 1024,
            'status' => MediaStatus::Ready,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/media/{$media->uuid}/transcribe")
            ->assertOk()
            ->assertJsonStructure(['text', 'lang']);
    }

    public function test_reports_accept_extended_types(): void
    {
        $reporter = $this->seedUser();

        foreach (['video', 'conversation', 'message'] as $type) {
            $this->actingAs($reporter, 'sanctum')
                ->postJson('/api/v1/reports', [
                    'type' => $type,
                    'target_id' => (string) Str::uuid(),
                    'reason' => 'spam',
                ])
                ->assertNotFound();
        }
    }

    private function totpCode(TwoFactorService $service, string $secret): string
    {
        $reflection = new \ReflectionClass($service);
        $totp = $reflection->getMethod('totp');
        $totp->setAccessible(true);
        $counter = (int) floor(time() / 30);

        return $totp->invoke($service, $secret, $counter);
    }
}
