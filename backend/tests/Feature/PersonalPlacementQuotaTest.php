<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Listing\Services\ListingService;
use Tests\TestCase;

/**
 * Персональная квота бесплатных размещений (решение 19.09).
 *
 * Порядок покрытия цены: персональная квота → месячная квота тарифа →
 * кредит → оплата. Бесплатное само по себе размещение (цена 0) не тратит
 * ничего. Квоту тратит создание объявления, котировка только показывает.
 */
class PersonalPlacementQuotaTest extends TestCase
{
    use RefreshDatabase;

    private int $categoryId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setting('feature.listing_payment_enabled', ['enabled' => true]);
        $this->setting('listing.placement.registered_price_cents', ['cents' => 3000]);
        $this->setting('listing.placement.subscriber_default_price_cents', ['cents' => 2000]);

        $this->categoryId = ListingCategory::query()->create([
            'name' => 'Наборы',
            'slug' => 'kits-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ])->id;
    }

    /** @param array<string, mixed> $value */
    private function setting(string $key, array $value): void
    {
        SystemSetting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'group' => 'billing']);
    }

    /** @param array<string, mixed> $attrs */
    private function seller(array $attrs = []): User
    {
        $user = User::factory()->create(array_merge([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ], $attrs));
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Продавец',
            'slug' => 'seller-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function subscribe(User $user, int $monthlyQuota): void
    {
        $plan = SubscriptionPlan::query()->create([
            'slug' => 'month-'.uniqid(),
            'name' => 'Месяц',
            'price_cents' => 9900,
            'period_days' => 30,
            'sort_order' => 1,
            'is_active' => true,
            'free_listings_per_month' => $monthlyQuota,
        ]);
        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addMonth(),
        ]);
        $this->recordPaidPlanPayment($user, (int) $plan->id, (int) $plan->price_cents);
    }

    private function publish(User $user, ?int $categoryId = null): Listing
    {
        return app(ListingService::class)->create($user, [
            'category_id' => $categoryId ?? $this->categoryId,
            'title' => 'Модель '.uniqid(),
            'description' => 'Проверка квоты размещения.',
            'price_cents' => 150000,
            'delivery_methods' => ['Почта России'],
            'publish' => true,
        ]);
    }

    private function quote(User $user): array
    {
        return $this->actingAs($user->fresh(), 'sanctum')
            ->getJson('/api/v1/listings/placement-quote?category_id='.$this->categoryId)
            ->assertOk()
            ->json('data');
    }

    public function test_personal_quota_goes_first_then_plan_quota_then_credit_then_payment(): void
    {
        $user = $this->seller(['free_listings_quota' => 1, 'listing_placement_credits' => 1]);
        $this->subscribe($user, 1);

        $this->assertSame('personal_quota', $this->quote($user)['free_reason']);
        $first = $this->publish($user);
        $this->assertSame('personal_quota', $first->placement_free_reason);
        $this->assertSame(1, (int) $user->fresh()->free_listings_used);

        $this->assertSame('subscription_quota', $this->quote($user)['free_reason']);
        $second = $this->publish($user->fresh());
        $this->assertSame('subscription_quota', $second->placement_free_reason);

        $this->assertSame('listing_credit', $this->quote($user)['free_reason']);
        $this->publish($user->fresh());
        $this->assertSame(0, (int) $user->fresh()->listing_placement_credits);

        $last = $this->quote($user);
        $this->assertFalse($last['is_free']);
        $this->assertSame(2000, $last['final_cents'], 'подписчик платит свою цену');

        $this->expectException(ValidationException::class);
        $this->publish($user->fresh());
    }

    public function test_unlimited_never_runs_out_and_still_counts(): void
    {
        $user = $this->seller(['free_listings_unlimited' => true, 'listing_placement_credits' => 1]);

        foreach (range(1, 3) as $_) {
            $this->assertSame('personal_quota', $this->publish($user->fresh())->placement_free_reason);
        }

        $fresh = $user->fresh();
        $this->assertSame(3, (int) $fresh->free_listings_used);
        $this->assertSame(1, (int) $fresh->listing_placement_credits, 'кредит не тронут');
        $this->assertTrue($this->quote($user)['personal_free_listings_unlimited']);
    }

    public function test_free_category_spends_nothing(): void
    {
        $free = ListingCategory::query()->create([
            'name' => 'Литература',
            'slug' => 'books-'.uniqid(),
            'sort_order' => 2,
            'is_active' => true,
            'listing_price_cents' => 0,
        ]);
        $user = $this->seller(['free_listings_quota' => 1, 'listing_placement_credits' => 1]);

        $listing = $this->publish($user, $free->id);

        $this->assertSame('free_category', $listing->placement_free_reason);
        $fresh = $user->fresh();
        $this->assertSame(0, (int) $fresh->free_listings_used);
        $this->assertSame(1, (int) $fresh->listing_placement_credits);
    }

    public function test_stale_second_tab_cannot_spend_the_last_unit_twice(): void
    {
        $user = $this->seller(['free_listings_quota' => 1]);

        $this->publish($user);

        // Объект из памяти ещё видит квоту 1 и used 0 — как вкладка, открытая
        // до первой публикации. Условное списание в базе не даёт второе.
        $this->expectException(ValidationException::class);
        $this->publish($user);
    }

    public function test_republishing_a_quota_listing_does_not_spend_again(): void
    {
        $user = $this->seller(['free_listings_quota' => 1]);
        $listing = $this->publish($user);

        $service = app(ListingService::class);
        $service->setStatus($listing, $user->fresh(), ListingStatus::Unpublished);
        $service->setStatus($listing->fresh(), $user->fresh(), ListingStatus::Published);

        $this->assertSame(1, (int) $user->fresh()->free_listings_used);
        $this->assertNotSame(ListingStatus::Unpublished, $listing->fresh()->status);
    }

    private function paidPlacement(User $user, array $metadata): Payment
    {
        return Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => 3000,
            'currency' => 'RUB',
            'status' => 'paid',
            'provider' => 'stub',
            'idempotency_key' => 'k-'.uniqid(),
            'paid_at' => now(),
            'metadata' => array_merge(['payable_type' => 'listing_placement'], $metadata),
        ]);
    }

    /**
     * Одна оплата — одно размещение. До 19.09 оплаченный платёж принимался
     * по uuid без проверки, на что он уже потрачен, и прямым запросом одна
     * оплата публиковала сколько угодно объявлений.
     */
    public function test_a_paid_placement_cannot_be_reused_for_other_listings(): void
    {
        $user = $this->seller();
        // Оплата без объявления — она стала кредитом, и кредит уже потрачен.
        $credited = $this->paidPlacement($user, ['granted_listing_credit' => true]);

        try {
            app(ListingService::class)->create($user, [
                'category_id' => $this->categoryId,
                'title' => 'Модель '.uniqid(),
                'description' => 'Попытка второй раз по той же оплате.',
                'price_cents' => 150000,
                'delivery_methods' => ['Почта России'],
                'publish' => true,
                'placement_payment_uuid' => $credited->uuid,
            ]);
            $this->fail('оплата, ставшая кредитом, опубликовала объявление');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('publish', $e->errors());
        }

        // Оплата, оформленная на черновик A, публикует A и не публикует B.
        $service = app(ListingService::class);
        $draftA = $service->create($user, ['category_id' => $this->categoryId, 'title' => 'A '.uniqid(), 'description' => 'Черновик A для проверки.', 'price_cents' => 1000, 'delivery_methods' => ['Почта России'], 'publish' => false]);
        $draftB = $service->create($user, ['category_id' => $this->categoryId, 'title' => 'B '.uniqid(), 'description' => 'Черновик B для проверки.', 'price_cents' => 1000, 'delivery_methods' => ['Почта России'], 'publish' => false]);
        $forA = $this->paidPlacement($user, ['listing_uuid' => $draftA->uuid]);

        try {
            $service->setStatus($draftB, $user, ListingStatus::Published, ['placement_payment_uuid' => $forA->uuid]);
            $this->fail('оплата за A опубликовала B');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('publish', $e->errors());
        }

        $published = $service->setStatus($draftA->fresh(), $user, ListingStatus::Published, ['placement_payment_uuid' => $forA->uuid]);
        $this->assertSame($forA->id, (int) $published->placement_payment_id);
        $this->assertNotNull($published->placement_covered_at);
    }

    public function test_plan_quota_is_not_eaten_by_free_categories(): void
    {
        $free = ListingCategory::query()->create([
            'name' => 'Литература',
            'slug' => 'books-'.uniqid(),
            'sort_order' => 2,
            'is_active' => true,
            'listing_price_cents' => 0,
        ]);
        $user = $this->seller();
        $this->subscribe($user, 1);

        $this->publish($user, $free->id);
        $this->publish($user->fresh(), $free->id);

        $quote = $this->quote($user);
        $this->assertSame(1, $quote['free_listings_remaining']);
        $this->assertSame('subscription_quota', $quote['free_reason']);
    }
}
