<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ModerationQueue;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Listing\Services\ListingPlacementPricingService;
use Modules\Listing\Services\ListingService;
use Tests\TestCase;

/**
 * Размещение: цена подписчика, повторная публикация и очередь модерации
 * (приёмка 16.09).
 *
 * Три разбора. Первый: подписка применялась поверх категорийной цены даже
 * когда та ниже — в бесплатной категории подписчик платил 20 ₽. Второй:
 * публикация из черновика считала котировку заново и не видела оплаченный
 * платёж объявления — деньги просили второй раз. Третий: восстановленное
 * объявление оставалось «на модерации» без записи в очереди.
 */
class ListingPlacementRepeatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->setting('feature.listing_payment_enabled', ['enabled' => true]);
        $this->setting('listing.placement.registered_price_cents', ['cents' => 3000]);
        $this->setting('listing.placement.subscriber_default_price_cents', ['cents' => 2000]);
    }

    /** @param array<string, mixed> $value */
    private function setting(string $key, array $value): void
    {
        SystemSetting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'group' => 'billing']);
    }

    private function category(?int $price = null, ?int $subscriberPrice = null): int
    {
        return ListingCategory::query()->create([
            'name' => 'Наборы',
            'slug' => 'kits-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
            'listing_price_cents' => $price,
            'subscriber_listing_price_cents' => $subscriberPrice,
        ])->id;
    }

    private function seller(bool $subscriber = false): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'listing_placement_credits' => 0,
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Продавец',
            'slug' => 'seller-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);
        $user->assignRole('user');

        if ($subscriber) {
            $plan = SubscriptionPlan::query()->create([
                'slug' => 'month-'.uniqid(),
                'name' => 'Месяц',
                'price_cents' => 9900,
                'period_days' => 30,
                'free_listings_per_month' => 0,
                'is_active' => true,
            ]);
            UserSubscription::query()->create([
                'user_id' => $user->id,
                'plan_id' => $plan->id,
                'status' => 'active',
                'starts_at' => now()->subDay(),
                'ends_at' => now()->addMonth(),
                'granted_by_admin_id' => $user->id,
            ]);
        }

        return $user->fresh();
    }

    private function draft(User $user, int $categoryId): Listing
    {
        return app(ListingService::class)->create($user, [
            'category_id' => $categoryId,
            'title' => 'Модель '.uniqid(),
            'description' => 'Проверка размещения и повторной публикации.',
            'price_cents' => 150000,
            'delivery_methods' => ['Почта России'],
            'publish' => false,
        ]);
    }

    private function paidPlacement(User $user, Listing $listing, int $cents, int $categoryId): Payment
    {
        return Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'provider' => 'stub',
            'status' => 'paid',
            'amount_cents' => $cents,
            'currency' => 'RUB',
            'metadata' => [
                'payable_type' => 'listing_placement',
                'listing_uuid' => $listing->uuid,
                'category_id' => $categoryId,
                'subcategory_id' => null,
            ],
        ]);
    }

    public function test_подписка_не_делает_размещение_дороже(): void
    {
        $free = $this->category(0);
        $cheap = $this->category(100);
        $subscriber = $this->seller(true);
        $plain = $this->seller(false);

        $pricing = app(ListingPlacementPricingService::class);

        $this->assertSame(0, $pricing->quote($subscriber, $free)['final_cents'], 'в бесплатной категории подписчик платит ноль');
        $this->assertSame(0, $pricing->quote($plain, $free)['final_cents']);
        $this->assertSame(100, $pricing->quote($subscriber, $cheap)['final_cents'], 'цена категории ниже подписочной — берём её');
        $this->assertSame(100, $pricing->quote($plain, $cheap)['final_cents']);

        // Там, где базовая дороже, подписка остаётся скидкой.
        $normal = $this->category(null);
        $this->assertSame(2000, $pricing->quote($subscriber, $normal)['final_cents']);
        $this->assertSame(3000, $pricing->quote($plain, $normal)['final_cents']);
    }

    public function test_подписчик_публикует_в_бесплатной_категории_без_оплаты(): void
    {
        $user = $this->seller(true);
        $listing = app(ListingService::class)->create($user, [
            'category_id' => $this->category(0),
            'title' => 'Модель '.uniqid(),
            'description' => 'Публикация подписчиком в бесплатной категории.',
            'price_cents' => 150000,
            'delivery_methods' => ['Почта России'],
            'publish' => true,
        ]);

        $this->assertContains($listing->status, [ListingStatus::PendingModeration, ListingStatus::Published]);
        $this->assertTrue((bool) $listing->placement_was_free);
    }

    public function test_повторная_публикация_оплаченного_объявления_бесплатна(): void
    {
        $categoryId = $this->category(null);
        $user = $this->seller(false);
        $listing = $this->draft($user, $categoryId);
        $payment = $this->paidPlacement($user, $listing, 3000, $categoryId);
        $listing->forceFill(['placement_payment_id' => $payment->id, 'placement_amount_cents' => 3000])->save();

        $service = app(ListingService::class);
        $published = $service->setStatus($listing->fresh(), $user, ListingStatus::Published);
        $this->assertContains($published->status, [ListingStatus::PendingModeration, ListingStatus::Published]);

        // Возврат в черновик и публикация снова — денег не просят.
        $draft = $service->setStatus($published, $user, ListingStatus::Draft);
        $this->assertSame(ListingStatus::Draft, $draft->status);

        $again = $service->setStatus($draft->fresh(), $user, ListingStatus::Published);
        $this->assertContains($again->status, [ListingStatus::PendingModeration, ListingStatus::Published]);
        $this->assertSame($payment->id, (int) $again->placement_payment_id);
    }

    public function test_неоплаченное_объявление_по_прежнему_требует_оплату(): void
    {
        $user = $this->seller(false);
        $listing = $this->draft($user, $this->category(null));

        $this->expectException(ValidationException::class);
        app(ListingService::class)->setStatus($listing, $user, ListingStatus::Published);
    }

    public function test_восстановленное_объявление_возвращается_в_очередь(): void
    {
        $categoryId = $this->category(0);
        $user = $this->seller(false);
        $service = app(ListingService::class);
        $listing = $service->create($user, [
            'category_id' => $categoryId,
            'title' => 'Модель '.uniqid(),
            'description' => 'Проверка очереди после восстановления.',
            'price_cents' => 150000,
            'delivery_methods' => ['Почта России'],
            'publish' => true,
        ]);

        if ($listing->status !== ListingStatus::PendingModeration) {
            $this->markTestSkipped('автопубликация включена — очередь не участвует');
        }

        $service->delete($listing, $user);
        // Пока объявление удалено, очередь помечает запись отменённой.
        ModerationQueue::query()
            ->where('moderatable_type', Listing::class)
            ->where('moderatable_id', $listing->id)
            ->update(['status' => 'cancelled']);

        $restored = $service->restore(Listing::onlyTrashed()->whereKey($listing->id)->firstOrFail(), $user);

        $this->assertSame(ListingStatus::PendingModeration, $restored->status);
        $this->assertSame('pending', ModerationQueue::query()
            ->where('moderatable_type', Listing::class)
            ->where('moderatable_id', $listing->id)
            ->value('status'), 'статус «на модерации» без записи в очереди — задача модератору не придёт');
    }
}
