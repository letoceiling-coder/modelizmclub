<?php

namespace Tests\Feature;

use App\Enums\ReferralStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\BonusTransaction;
use App\Models\EmailVerificationCode;
use App\Models\PhoneVerificationCode;
use App\Models\PromoPool;
use App\Models\Referral;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class PromoPoolAndReferralRewardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Config::set('sms.driver', 'log');
        Config::set('sms.verification.resend_cooldown_seconds', 0);

        SubscriptionPlan::query()->create([
            'slug' => 'year',
            'name' => 'Год',
            'price_cents' => 79900,
            'period_days' => 365,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        SystemSetting::query()->updateOrCreate(
            ['key' => 'referral_program'],
            ['value' => [
                'enabled' => true,
                'per_invite' => 1,
                'max_bonus' => 10,
                'reward_listing_credits' => true,
                'reward_subscription_days' => 0,
            ], 'group' => 'marketing'],
        );
    }

    public function test_admin_can_create_auto_assign_pool_and_counter_increments(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/promo-pools', [
                'name' => 'Первые 300 пользователей — бесплатно до 31.12.2026',
                'max_activations' => 300,
                'expires_at' => '2026-12-31 23:59:59',
                'auto_assign_on_register' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.max_activations', 300)
            ->assertJsonPath('data.current_activations', 0)
            ->assertJsonPath('data.is_granting', true);

        $first = $this->verifyNewUser();
        $this->assertTrue($first->is_first_hundred);
        $this->assertNotNull($first->promo_pool_id);
        $this->assertTrue($first->hasActiveSubscription());
        $ends = UserSubscription::query()->where('user_id', $first->id)->value('ends_at');
        $this->assertSame('2026-12-31', \Illuminate\Support\Carbon::parse($ends)->timezone(config('app.timezone'))->format('Y-m-d'));

        $this->assertSame(1, (int) PromoPool::query()->value('current_activations'));

        $this->getJson('/api/v1/public/stats')
            ->assertOk()
            ->assertJsonPath('data.first_hundred.taken', 1)
            ->assertJsonPath('data.first_hundred.total', 300)
            ->assertJsonPath('data.first_hundred.enabled', true);
    }

    public function test_pool_stops_granting_after_limit(): void
    {
        $this->actingAs(
            User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]),
            'sanctum',
        )->postJson('/api/v1/admin/promo-pools', [
            'name' => 'Два места',
            'max_activations' => 1,
            'expires_at' => now()->addYear()->toIso8601String(),
            'auto_assign_on_register' => true,
        ])->assertCreated();

        $first = $this->verifyNewUser();
        $second = $this->verifyNewUser();

        $this->assertTrue($first->is_first_hundred);
        $this->assertFalse($second->is_first_hundred);
        $this->assertSame(1, (int) PromoPool::query()->value('current_activations'));
    }

    public function test_pause_stops_new_grants_and_keeps_existing_seat(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $uuid = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/promo-pools', [
                'name' => 'Пауза',
                'max_activations' => 10,
                'expires_at' => now()->addYear()->toIso8601String(),
                'auto_assign_on_register' => true,
            ])
            ->json('data.uuid');

        $holder = $this->verifyNewUser();
        $this->assertTrue($holder->hasActiveSubscription());

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/promo-pools/{$uuid}/pause")
            ->assertOk()
            ->assertJsonPath('data.is_granting', false);

        $this->assertTrue($holder->fresh()->hasActiveSubscription());

        $next = $this->verifyNewUser();
        $this->assertFalse($next->is_first_hundred);
    }

    public function test_expired_promo_subscription_is_cancelled_by_command(): void
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'is_first_hundred' => true,
            'email_verified_at' => now(),
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Expired Promo',
            'slug' => 'expired-promo-'.uniqid(),
        ]);
        $planId = (int) SubscriptionPlan::query()->where('slug', 'year')->value('id');
        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $planId,
            'status' => 'active',
            'starts_at' => now()->subYear(),
            'ends_at' => now()->subMinute(),
            'auto_renew' => false,
        ]);

        $this->artisan('subscription:check-expired')->assertSuccessful();

        $this->assertSame('cancelled', UserSubscription::query()->where('user_id', $user->id)->value('status'));
    }

    public function test_referral_bonus_is_not_granted_until_phone_verified(): void
    {
        $referrer = $this->seedUser('ref');

        $email = 'invitee-'.uniqid().'@example.com';
        $this->postJson('/api/v1/auth/register', [
            'display_name' => 'Invitee User',
            'email' => $email,
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'registration_track' => 'community',
            'referral_code' => $referrer->referral_code,
            'accept_terms' => true,
            'accept_privacy' => true,
        ])->assertCreated();

        $invitee = User::query()->where('email', $email)->firstOrFail();
        $this->assertSame($referrer->id, (int) $invitee->referred_by);
        $this->assertSame(0, (int) $referrer->fresh()->listing_placement_credits);
        $this->assertDatabaseHas('referrals', [
            'inviter_id' => $referrer->id,
            'invitee_id' => $invitee->id,
            'status' => ReferralStatus::Pending->value,
        ]);

        $this->verifyPhone($invitee);

        $referrer->refresh();
        $this->assertSame(1, (int) $referrer->listing_placement_credits);
        $this->assertDatabaseHas('bonus_transactions', [
            'account_user_id' => $referrer->id,
            'type' => 'referral',
            'amount' => 1,
        ]);
        $this->assertSame(
            ReferralStatus::Completed,
            Referral::query()->where('invitee_id', $invitee->id)->first()?->status,
        );
    }

    public function test_referral_bonus_respects_max_cap_after_phone_verify(): void
    {
        SystemSetting::query()->where('key', 'referral_program')->update([
            'value' => ['enabled' => true, 'per_invite' => 1, 'max_bonus' => 2, 'reward_listing_credits' => true],
        ]);

        $referrer = $this->seedUser('cap');

        for ($i = 0; $i < 3; $i++) {
            $email = 'friend-'.$i.'-'.uniqid().'@example.com';
            $this->postJson('/api/v1/auth/register', [
                'display_name' => 'Friend User',
                'email' => $email,
                'password' => 'Password1!',
                'password_confirmation' => 'Password1!',
                'registration_track' => 'community',
                'referral_code' => $referrer->referral_code,
                'accept_terms' => true,
                'accept_privacy' => true,
            ])->assertCreated();
            $invitee = User::query()->where('email', $email)->firstOrFail();
            $this->verifyPhone($invitee, '7989762565'.$i);
        }

        $referrer->refresh();
        $this->assertSame(2, (int) $referrer->listing_placement_credits);
        $this->assertSame(2, BonusTransaction::query()->where('account_user_id', $referrer->id)->where('type', 'referral')->count());
    }

    public function test_register_reads_referral_cookie_and_click_is_counted(): void
    {
        $referrer = $this->seedUser('click');

        $this->postJson('/api/v1/public/referrals/click', ['code' => $referrer->referral_code])
            ->assertOk();
        $this->assertSame(1, (int) $referrer->fresh()->referral_click_count);

        $email = 'cookie-'.uniqid().'@example.com';
        $this->withUnencryptedCookie('mdlzm_ref', $referrer->referral_code)
            ->postJson('/api/v1/auth/register', [
                'display_name' => 'Cookie User',
                'email' => $email,
                'password' => 'Password1!',
                'password_confirmation' => 'Password1!',
                'registration_track' => 'community',
                'accept_terms' => true,
                'accept_privacy' => true,
            ])
            ->assertCreated();

        $invitee = User::query()->where('email', $email)->firstOrFail();
        $this->assertSame($referrer->id, (int) $invitee->referred_by);
    }

    public function test_me_referrals_returns_dashboard_and_pending_status(): void
    {
        $referrer = $this->seedUser('dash');
        $invitee = $this->seedUser('pend');
        $invitee->forceFill(['referred_by' => $referrer->id, 'phone_verified_at' => null])->save();
        Referral::query()->create([
            'inviter_id' => $referrer->id,
            'invitee_id' => $invitee->id,
            'status' => ReferralStatus::Pending,
        ]);
        $referrer->forceFill(['referral_click_count' => 4])->save();

        $this->actingAs($referrer, 'sanctum')
            ->getJson('/api/v1/users/me/referrals')
            ->assertOk()
            ->assertJsonPath('data.clicks', 4)
            ->assertJsonPath('data.invited_count', 1)
            ->assertJsonPath('data.verified', 0)
            ->assertJsonPath('data.invited.0.status', 'pending');
    }

    private function seedUser(string $suffix): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'User '.$suffix,
            'slug' => 'user-'.$suffix.'-'.uniqid(),
        ]);
        $user->ensureReferralCode();

        return $user->fresh(['profile']);
    }

    private function verifyNewUser(): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::PendingVerification,
            'email_verified_at' => null,
            'is_first_hundred' => false,
            'promo_pool_id' => null,
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

    private function verifyPhone(User $user, string $digits = '79897625658'): void
    {
        $phone = '+'.$digits;
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/account/phone/send-code', ['phone' => $phone])
            ->assertStatus(202);

        $code = PhoneVerificationCode::query()->where('user_id', $user->id)->value('code');
        $this->assertNotNull($code);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/account/phone/verify', [
                'phone' => $phone,
                'code' => $code,
            ])
            ->assertOk();
    }
}
