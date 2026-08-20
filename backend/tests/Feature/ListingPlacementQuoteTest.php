<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\ListingCategory;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ListingPlacementQuoteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    /** @param array<string, mixed> $value */
    private function upsertSetting(string $key, array $value): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'group' => 'billing'],
        );
    }

    private function seedVerifiedUser(string $suffix = 'a'): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => "User {$suffix}",
            'slug' => "user-{$suffix}-".uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);
        $user->assignRole('user');

        return $user;
    }

    private function attachSubscription(User $user, int $freeListingsPerMonth = 0): void
    {
        $plan = SubscriptionPlan::query()->create([
            'slug' => 'month-'.uniqid(),
            'name' => 'Месяц',
            'price_cents' => 9900,
            'period_days' => 30,
            'sort_order' => 1,
            'is_active' => true,
            'free_listings_per_month' => $freeListingsPerMonth,
        ]);
        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addMonth(),
        ]);
    }

    public function test_subscriber_quote_uses_system_subscriber_price_not_registered(): void
    {
        $categoryId = ListingCategory::query()->create([
            'name' => 'Наборы',
            'slug' => 'kits-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ])->id;

        $this->upsertSetting('listing.placement.registered_price_cents', ['cents' => 5000]);
        $this->upsertSetting('listing.placement.subscriber_default_price_cents', ['cents' => 2000]);

        $user = $this->seedVerifiedUser();
        $this->attachSubscription($user);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/listings/placement-quote?category_id='.$categoryId)
            ->assertOk()
            ->assertJsonPath('data.base_cents', 5000)
            ->assertJsonPath('data.final_cents', 2000)
            ->assertJsonPath('data.has_active_subscription', true)
            ->assertJsonPath('data.is_free', false);
    }

    public function test_subscriber_quote_falls_back_to_20_rub_when_setting_is_empty(): void
    {
        $categoryId = ListingCategory::query()->create([
            'name' => 'Наборы',
            'slug' => 'kits-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ])->id;

        $this->upsertSetting('listing.placement.registered_price_cents', ['cents' => 5000]);
        $this->upsertSetting('listing.placement.subscriber_default_price_cents', ['cents' => null]);

        $user = $this->seedVerifiedUser();
        $this->attachSubscription($user);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/listings/placement-quote?category_id='.$categoryId)
            ->assertOk()
            ->assertJsonPath('data.final_cents', 2000)
            ->assertJsonPath('data.has_active_subscription', true);
    }
}
