<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\EmailVerificationCode;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use App\Support\FirstHundredPromo;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class FirstHundredPromoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        SubscriptionPlan::query()->create([
            'slug' => 'year',
            'name' => 'Год',
            'price_cents' => 79900,
            'period_days' => 365,
            'sort_order' => 1,
            'is_active' => true,
        ]);
    }

    public function test_email_verification_grants_subscription_when_promo_enabled(): void
    {
        $this->putPromo(['enabled' => true, 'total' => 2]);

        $user = $this->verifyNewUser();

        $this->assertTrue($user->is_first_hundred);
        $this->assertDatabaseHas('user_subscriptions', [
            'user_id' => $user->id,
            'status' => 'active',
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/subscription')
            ->assertOk()
            ->assertJsonPath('data.is_active', true);
    }

    public function test_email_verification_does_not_grant_when_promo_disabled(): void
    {
        $this->putPromo(['enabled' => false, 'total' => 100]);

        $user = $this->verifyNewUser();

        $this->assertFalse($user->is_first_hundred);
        $this->assertDatabaseMissing('user_subscriptions', [
            'user_id' => $user->id,
            'status' => 'active',
        ]);
    }

    public function test_quota_stops_after_admin_limit(): void
    {
        $this->putPromo(['enabled' => true, 'total' => 1]);

        $first = $this->verifyNewUser();
        $second = $this->verifyNewUser();

        $this->assertTrue($first->is_first_hundred);
        $this->assertFalse($second->is_first_hundred);
        $this->assertDatabaseHas('user_subscriptions', ['user_id' => $first->id, 'status' => 'active']);
        $this->assertDatabaseMissing('user_subscriptions', ['user_id' => $second->id, 'status' => 'active']);
    }

    public function test_admin_disable_cancels_unpaid_promo_and_keeps_paid(): void
    {
        $this->putPromo(['enabled' => true, 'total' => 2]);

        $promoUser = $this->verifyNewUser();
        $paidUser = $this->verifyNewUser();

        Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $paidUser->id,
            'amount_cents' => 79900,
            'currency' => 'RUB',
            'status' => 'paid',
            'provider' => 'vtb',
            'metadata' => ['plan_id' => SubscriptionPlan::query()->where('slug', 'year')->value('id')],
            'paid_at' => now(),
        ]);

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/v1/admin/settings', [
                'settings' => [[
                    'key' => FirstHundredPromo::SETTING_KEY,
                    'group' => 'marketing',
                    'value' => ['enabled' => false, 'total' => 2, 'taken' => 99],
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.0.value.enabled', false)
            ->assertJsonPath('data.0.value.taken', 2);

        $stored = SystemSetting::query()->where('key', FirstHundredPromo::SETTING_KEY)->value('value');
        $this->assertIsArray($stored);
        $this->assertArrayNotHasKey('taken', $stored);

        $this->assertDatabaseHas('user_subscriptions', [
            'user_id' => $promoUser->id,
            'status' => 'cancelled',
        ]);
        $this->assertDatabaseHas('user_subscriptions', [
            'user_id' => $paidUser->id,
            'status' => 'active',
        ]);
        $this->assertFalse($promoUser->fresh()->hasActiveSubscription());
        $this->assertTrue($paidUser->fresh()->hasActiveSubscription());
    }

    public function test_reducing_quota_keeps_only_the_first_seats(): void
    {
        $this->putPromo(['enabled' => true, 'total' => 2]);
        $first = $this->verifyNewUser();
        $second = $this->verifyNewUser();

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $this->actingAs($admin, 'sanctum')
            ->patchJson('/api/v1/admin/settings', [
                'settings' => [[
                    'key' => FirstHundredPromo::SETTING_KEY,
                    'group' => 'marketing',
                    'value' => ['enabled' => true, 'total' => 1],
                ]],
            ])
            ->assertOk();

        $this->assertTrue($first->fresh()->hasActiveSubscription());
        $this->assertFalse($second->fresh()->hasActiveSubscription());
        $this->assertSame('cancelled', UserSubscription::query()->where('user_id', $second->id)->value('status'));
    }

    public function test_public_stats_reflect_live_taken_count_and_admin_total(): void
    {
        $this->putPromo(['enabled' => true, 'total' => 5]);
        User::factory()->count(2)->create([
            'is_first_hundred' => true,
            'status' => UserStatus::Active,
        ]);

        $this->getJson('/api/v1/public/stats')
            ->assertOk()
            ->assertJsonPath('data.first_hundred.taken', 2)
            ->assertJsonPath('data.first_hundred.total', 5)
            ->assertJsonPath('data.first_hundred.enabled', true);
    }

    /** @param array{enabled: bool, total: int} $value */
    private function putPromo(array $value): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => FirstHundredPromo::SETTING_KEY],
            ['value' => $value, 'group' => 'marketing'],
        );
    }

    private function verifyNewUser(): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::PendingVerification,
            'email_verified_at' => null,
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Promo User',
            'slug' => 'promo-'.uniqid(),
        ]);

        app(\Modules\Auth\Services\EmailVerificationService::class)->issueCode($user);
        $code = EmailVerificationCode::query()->where('user_id', $user->id)->value('code');
        $this->assertNotNull($code);

        $this->postJson('/api/v1/auth/verify-email', [
            'email' => $user->email,
            'code' => $code,
        ])->assertOk();

        return $user->fresh();
    }
}
