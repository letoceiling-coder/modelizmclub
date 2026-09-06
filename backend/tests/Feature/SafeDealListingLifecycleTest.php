<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SafeDeal;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Services\SafeDealService;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Что происходит с объявлением, когда сделка приходит к развязке.
 *
 * Предмет один. Завершённая сделка означает, что он уехал к покупателю, и в
 * каталоге ему больше не место; отменённая или возвращённая — что он никуда
 * не уехал и остаётся в продаже. До 07.09 разницы не было: `ListingStatus::Sold`
 * лежал в перечислении и не выставлялся нигде, лот после продажи возвращался
 * в каталог и его мог купить следующий.
 *
 * Проверяется состояние объявления, а не код ответа: именно оно решает,
 * увидит ли товар следующий покупатель.
 */
class SafeDealListingLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(string $suffix): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => "User {$suffix}",
            'slug' => "user-{$suffix}-".uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function seedListing(User $seller, int $priceCents = 100000): Listing
    {
        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
        ]);

        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Test listing',
            'slug' => 'test-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => $priceCents,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }

    private function fund(User $user, int $kopecks): void
    {
        app(WalletService::class)->credit($user, $kopecks, WalletTransactionType::Topup, 'test top-up');
    }

    /** @return array{0: User, 1: User, 2: Listing, 3: string} */
    private function openDeal(int $priceCents = 100000): array
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller, $priceCents);
        $this->fund($buyer, $priceCents);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.uuid');

        return [$seller, $buyer, $listing, $uuid];
    }

    public function test_completed_deal_marks_listing_sold(): void
    {
        [, $buyer, $listing, $uuid] = $this->openDeal();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/confirm")
            ->assertOk();

        $listing->refresh();
        $this->assertSame(ListingStatus::Sold, $listing->status);
        $this->assertNull($listing->reserved_at);
    }

    public function test_sold_listing_leaves_the_catalogue(): void
    {
        [, $buyer, $listing, $uuid] = $this->openDeal();

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonFragment(['uuid' => $listing->uuid]);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/confirm")
            ->assertOk();

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonMissing(['uuid' => $listing->uuid]);
    }

    public function test_sold_listing_cannot_be_bought_again(): void
    {
        [, $buyer, $listing, $uuid] = $this->openDeal();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/confirm")
            ->assertOk();

        $second = $this->seedUser('second');
        $this->fund($second, 100000);

        // Отказывает политика: `create` требует Published, поэтому проданный
        // лот не доходит до расчёта. Код 403, а не 422 — это её отказ.
        $this->actingAs($second, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertForbidden();

        $this->assertSame(
            0,
            SafeDeal::query()->where('listing_id', $listing->id)->where('buyer_id', $second->id)->count(),
            'на проданный лот не должно появиться второй сделки',
        );
    }

    public function test_auto_release_marks_listing_sold(): void
    {
        [, , $listing, $uuid] = $this->openDeal();

        $deal = SafeDeal::query()->where('uuid', $uuid)->firstOrFail();
        $deal->update([
            'status' => SafeDealStatus::Delivered,
            'delivered_at' => now()->subDays(8),
            'auto_release_at' => now()->subMinute(),
        ]);

        $this->artisan('safe-deals:auto-release')->assertSuccessful();

        $listing->refresh();
        $this->assertSame(ListingStatus::Sold, $listing->status);
    }

    public function test_cancelled_deal_leaves_the_listing_on_sale(): void
    {
        [, $buyer, $listing, $uuid] = $this->openDeal();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/cancel")
            ->assertOk();

        $listing->refresh();
        $this->assertSame(ListingStatus::Published, $listing->status);
        $this->assertNull($listing->reserved_at, 'отменённая сделка должна снимать резерв');

        // И товар снова можно купить — иначе отмена стоила бы продавцу лота.
        $second = $this->seedUser('second');
        $this->fund($second, 100000);
        $this->actingAs($second, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated();
    }

    public function test_dispute_refund_leaves_the_listing_on_sale(): void
    {
        [, $buyer, $listing, $uuid] = $this->openDeal();

        $disputeUuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/dispute", ['reason' => 'Товар повреждён'])
            ->assertCreated()
            ->json('data.uuid');

        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/disputes/{$disputeUuid}/resolve", ['in_favor_of' => 'buyer'])
            ->assertOk();

        $this->assertSame(
            SafeDealStatus::Refunded,
            SafeDeal::query()->where('uuid', $uuid)->firstOrFail()->status,
        );

        $listing->refresh();
        $this->assertSame(ListingStatus::Published, $listing->status, 'возврат — не продажа');
        $this->assertNull($listing->reserved_at);
    }

    public function test_dispute_resolved_for_seller_marks_listing_sold(): void
    {
        [, $buyer, $listing, $uuid] = $this->openDeal();

        $disputeUuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/dispute", ['reason' => 'Товар повреждён'])
            ->assertCreated()
            ->json('data.uuid');

        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/disputes/{$disputeUuid}/resolve", ['in_favor_of' => 'seller'])
            ->assertOk();

        $listing->refresh();
        $this->assertSame(ListingStatus::Sold, $listing->status, 'товар остался у покупателя — это продажа');
    }

    public function test_expired_checkout_leaves_the_listing_on_sale(): void
    {
        [, , $listing, $uuid] = $this->openDeal();

        // Брошенный чекаут: покупатель не дошёл до формы оплаты. На кошельке
        // такого состояния не бывает, оно живёт у банковского провайдера,
        // поэтому воспроизводим статус напрямую — проверяется развязка.
        $deal = SafeDeal::query()->where('uuid', $uuid)->firstOrFail();
        $deal->update(['status' => SafeDealStatus::Created]);
        $listing->forceFill(['reserved_at' => now()])->save();

        app(SafeDealService::class)->expireCheckout($deal);

        $listing->refresh();
        $this->assertSame(ListingStatus::Published, $listing->status);
        $this->assertNull($listing->reserved_at);
    }

    public function test_action_response_carries_the_actor_permissions(): void
    {
        [$seller, , , $uuid] = $this->openDeal();

        // Без зрителя canFlags() отдаёт всё false, включая view, и интерфейс
        // гасит продавцу кнопки сразу после его же отгрузки.
        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/ship", ['tracking_number' => 'TRACK1'])
            ->assertOk()
            ->assertJsonPath('data.can.view', true)
            ->assertJsonPath('data.status', 'shipped');
    }

    public function test_action_response_reflects_the_completed_transaction(): void
    {
        [, $buyer, , $uuid] = $this->openDeal();

        // cancelled_at пишется внутри транзакции: без fresh() наружу уходило
        // состояние до неё.
        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.can.view', true);

        $this->assertNotNull(
            SafeDeal::query()->where('uuid', $uuid)->firstOrFail()->cancelled_at,
        );
    }
}
