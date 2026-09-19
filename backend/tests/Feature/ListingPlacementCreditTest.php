<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Modules\Listing\Services\ListingService;
use Tests\TestCase;

/**
 * Кредит размещения тратится при публикации (ДФ-5, 15.09).
 *
 * До починки котировка обнуляла цену при кредите ≥ 1, создание объявления
 * видело нулевую цену и публиковало «бесплатно», а списание стояло в ветке,
 * до которой нулевая цена не доходила. У подписчика на проде было пять
 * бесплатных объявлений за месяц при одном кредите.
 */
class ListingPlacementCreditTest extends TestCase
{
    use RefreshDatabase;

    private int $categoryId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setting('feature.listing_payment_enabled', ['enabled' => true]);
        $this->setting('listing.placement.registered_price_cents', ['cents' => 3000]);

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

    private function seller(int $credits): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'listing_placement_credits' => $credits,
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Продавец',
            'slug' => 'seller-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function publish(User $user): Listing
    {
        return app(ListingService::class)->create($user, [
            'category_id' => $this->categoryId,
            'title' => 'Модель '.uniqid(),
            'description' => 'Проверка списания кредита размещения.',
            'price_cents' => 150000,
            'delivery_methods' => ['Почта России'],
            'publish' => true,
        ]);
    }

    public function test_кредит_списывается_и_второе_объявление_требует_оплату(): void
    {
        $user = $this->seller(1);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/listings/placement-quote?category_id='.$this->categoryId)
            ->assertJsonPath('data.final_cents', 0)
            ->assertJsonPath('data.free_reason', 'listing_credit');

        $first = $this->publish($user);

        $this->assertSame(0, (int) $user->fresh()->listing_placement_credits);
        $this->assertFalse((bool) $first->placement_was_free, 'кредит — не бесплатность');
        $this->assertSame(3000, (int) $first->placement_amount_cents);

        // Свежая копия: actingAs держит объект, прочитанный до списания.
        $this->actingAs($user->fresh(), 'sanctum')
            ->getJson('/api/v1/listings/placement-quote?category_id='.$this->categoryId)
            ->assertJsonPath('data.final_cents', 3000)
            ->assertJsonPath('data.is_free', false);

        // Здесь намеренно устаревший объект с кредитом 1 в памяти: так выглядит
        // вторая вкладка, открытая до первой публикации. Условное списание в
        // базе не должно дать ей опубликовать бесплатно.
        try {
            $this->publish($user);
            $this->fail('второе объявление без кредита опубликовалось бесплатно');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('publish', $e->errors());
        }

        $this->assertSame(1, Listing::query()->where('user_id', $user->id)->count());
    }

    public function test_два_кредита_дают_ровно_два_объявления(): void
    {
        $user = $this->seller(2);

        $this->publish($user);
        $this->publish($user);

        $this->assertSame(0, (int) $user->fresh()->listing_placement_credits);
        $this->expectException(ValidationException::class);
        $this->publish($user);
    }

    public function test_бесплатное_без_кредита_кредит_не_трогает(): void
    {
        $this->setting('listing.placement.registered_price_cents', ['cents' => 0]);
        $user = $this->seller(1);

        $listing = $this->publish($user);

        $this->assertTrue((bool) $listing->placement_was_free);
        $this->assertSame(1, (int) $user->fresh()->listing_placement_credits);
    }

    public function test_черновик_кредит_не_тратит(): void
    {
        $user = $this->seller(1);

        app(ListingService::class)->create($user, [
            'category_id' => $this->categoryId,
            'title' => 'Черновик',
            'description' => 'Черновик не публикуется и не платит.',
            'price_cents' => 100000,
            'delivery_methods' => ['Почта России'],
            'publish' => false,
        ]);

        $this->assertSame(1, (int) $user->fresh()->listing_placement_credits);
    }
}
