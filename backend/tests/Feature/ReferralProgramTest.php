<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\BonusAccount;
use App\Models\BonusTransaction;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReferralProgramTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        SystemSetting::query()->updateOrCreate(
            ['key' => 'referral_program'],
            ['value' => ['enabled' => true, 'per_invite' => 1, 'max_bonus' => 10], 'group' => 'marketing'],
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

    public function test_referrer_receives_listing_credit_when_invitee_registers(): void
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
        $this->assertSame(1, (int) $referrer->listing_placement_credits);
        $this->assertDatabaseHas('bonus_transactions', [
            'account_user_id' => $referrer->id,
            'type' => 'referral',
            'amount' => 1,
        ]);
    }

    public function test_referral_bonus_respects_max_cap(): void
    {
        SystemSetting::query()->where('key', 'referral_program')->update([
            'value' => ['enabled' => true, 'per_invite' => 1, 'max_bonus' => 2],
        ]);

        $referrer = $this->seedUser('cap');

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/auth/register', [
                'display_name' => 'Friend User',
                'email' => 'friend-'.$i.'-'.uniqid().'@example.com',
                'password' => 'Password1!',
                'password_confirmation' => 'Password1!',
                'registration_track' => 'community',
                'referral_code' => $referrer->referral_code,
                'accept_terms' => true,
                'accept_privacy' => true,
            ])->assertCreated();
        }

        $referrer->refresh();
        $this->assertSame(2, (int) $referrer->listing_placement_credits);
        $this->assertSame(2, BonusTransaction::query()->where('account_user_id', $referrer->id)->where('type', 'referral')->count());
    }

    public function test_me_referrals_returns_bonus_totals(): void
    {
        $referrer = $this->seedUser('me');
        BonusAccount::query()->firstOrCreate(['user_id' => $referrer->id]);
        BonusTransaction::query()->create([
            'account_user_id' => $referrer->id,
            'amount' => 2,
            'type' => 'referral',
            'description' => 'test',
            'created_at' => now(),
        ]);
        $referrer->listing_placement_credits = 2;
        $referrer->save();

        $this->actingAs($referrer, 'sanctum')
            ->getJson('/api/v1/users/me/referrals')
            ->assertOk()
            ->assertJsonPath('data.bonus', 2)
            ->assertJsonPath('data.listing_credits', 2)
            ->assertJsonPath('data.per_invite', 1);
    }
}
