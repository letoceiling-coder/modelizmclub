<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\EmailVerificationCode;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

        SystemSetting::query()->updateOrCreate(
            ['key' => 'first_hundred_stats'],
            ['value' => ['enabled' => true, 'total' => 2, 'plan_slug' => 'year'], 'group' => 'marketing'],
        );
    }

    public function test_email_verification_marks_first_hundred_without_subscription(): void
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

        $user->refresh();
        $this->assertTrue($user->is_first_hundred);
        $this->assertDatabaseMissing('user_subscriptions', [
            'user_id' => $user->id,
            'status' => 'active',
        ]);
    }

    public function test_public_stats_reflect_live_taken_count(): void
    {
        User::factory()->count(2)->create([
            'is_first_hundred' => true,
            'status' => UserStatus::Active,
        ]);

        $this->getJson('/api/v1/public/stats')
            ->assertOk()
            ->assertJsonPath('data.first_hundred.taken', 2)
            ->assertJsonPath('data.first_hundred.total', 2);
    }
}
