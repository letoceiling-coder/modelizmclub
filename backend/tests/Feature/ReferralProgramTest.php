<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\BonusAccount;
use App\Models\BonusTransaction;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Services\BonusPointsService;
use Tests\TestCase;

class ReferralProgramTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SystemSetting::query()->updateOrCreate(
            ['key' => 'referral_program'],
            ['value' => ['enabled' => true, 'points_per_invite' => 100, 'max_paid_invites' => 0], 'group' => 'marketing'],
        );
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
            'slug' => 'user-'.$suffix,
        ]);
        $user->ensureReferralCode();

        return $user->fresh(['profile']);
    }

    public function test_referrer_does_not_receive_credit_on_register_only(): void
    {
        $referrer = $this->seedUser('ref');

        $this->postJson('/api/v1/auth/register', [
            'display_name' => 'Invitee User',
            'email' => 'invitee-'.uniqid().'@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'registration_track' => 'community',
            'referral_code' => $referrer->referral_code,
            'accept_terms' => true,
            'accept_privacy' => true,
        ])->assertCreated();

        $referrer->refresh();
        $this->assertSame(0, (int) $referrer->listing_placement_credits);
        $this->assertSame(0, BonusTransaction::query()->where('account_user_id', $referrer->id)->where('type', 'referral')->count());
    }

    public function test_me_referrals_returns_bonus_totals(): void
    {
        $referrer = $this->seedUser('me');
        BonusAccount::query()->firstOrCreate(['user_id' => $referrer->id]);
        BonusTransaction::query()->create([
            'account_user_id' => $referrer->id,
            'amount' => 200,
            'type' => BonusPointsService::TYPE_REFERRAL,
            'description' => 'test',
            'created_at' => now(),
        ]);

        $this->actingAs($referrer, 'sanctum')
            ->getJson('/api/v1/users/me/referrals')
            ->assertOk()
            ->assertJsonPath('data.bonus', 200)
            ->assertJsonPath('data.points_per_invite', 100)
            ->assertJsonPath('data.clicks', 0);
    }
}
