<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Services\SafeDealService;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Повторное нажатие «Оплатить» не должно создавать второй платёж.
 *
 * Бэкенд эту защиту держал всегда: `PaymentRecorder::createPending` при
 * совпадении ключа возвращает уже созданный платёж. Не работала она оттого,
 * что фронт слал каждый раз новый ключ — `newIdempotencyKey()` возвращала
 * свежий `crypto.randomUUID()` на каждый вызов, хотя комментарий над ней
 * обещал обратное. За два месяца так накопилось 44 висящих `pending`.
 *
 * Здесь закреплено поведение сервера при одинаковом ключе — то, на что
 * фронт теперь опирается (см. `frontend/src/lib/payments/idempotency.ts`).
 */
class PaymentIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(string $name = 'Payer'): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => $name,
            'slug' => Str::slug($name).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function seedPlan(string $slug = 'year'): SubscriptionPlan
    {
        return SubscriptionPlan::query()->updateOrCreate(
            ['slug' => $slug],
            [
                'name' => 'Год',
                'price_cents' => 99000,
                'period_days' => 365,
                'is_active' => true,
                'sort_order' => 2,
            ],
        );
    }

    public function test_two_taps_with_one_key_create_one_payment(): void
    {
        config(['billing.provider' => 'stub']);
        $this->seedPlan();
        $user = $this->seedUser();
        $key = (string) Str::uuid();

        $first = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year', 'idempotency_key' => $key])
            ->assertCreated()
            ->json('data.payment_uuid');

        $second = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year', 'idempotency_key' => $key])
            ->assertCreated()
            ->json('data.payment_uuid');

        $this->assertSame($first, $second);
        $this->assertSame(1, Payment::query()->where('user_id', $user->id)->count());
    }

    public function test_third_tap_changes_nothing(): void
    {
        config(['billing.provider' => 'stub']);
        $this->seedPlan();
        $user = $this->seedUser();
        $key = (string) Str::uuid();

        $uuids = [];
        foreach (range(1, 3) as $_) {
            $uuids[] = $this->actingAs($user, 'sanctum')
                ->postJson('/api/v1/payments', ['plan_slug' => 'year', 'idempotency_key' => $key])
                ->assertCreated()
                ->json('data.payment_uuid');
        }

        $this->assertCount(1, array_unique($uuids));
        $this->assertSame(1, Payment::query()->where('user_id', $user->id)->count());
    }

    public function test_new_attempt_after_success_creates_a_second_payment(): void
    {
        // Ключ сбрасывается после успеха — иначе второй год подписки просто
        // не купить: сервер вернул бы прошлый платёж.
        config(['billing.provider' => 'stub']);
        $this->seedPlan();
        $user = $this->seedUser();

        $first = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year', 'idempotency_key' => (string) Str::uuid()])
            ->assertCreated()
            ->json('data.payment_uuid');

        $second = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year', 'idempotency_key' => (string) Str::uuid()])
            ->assertCreated()
            ->json('data.payment_uuid');

        $this->assertNotSame($first, $second);
        $this->assertSame(2, Payment::query()->where('user_id', $user->id)->count());
    }

    public function test_same_key_from_another_user_is_a_separate_payment(): void
    {
        // Ключ выдаёт браузер, и совпадение у двух людей — вопрос вероятности,
        // а не злого умысла. Пока уникальность была глобальной, поиск у
        // второго (он идёт по паре «ключ + пользователь») ничего не находил,
        // вставка упиралась в чужую строку, и человек получал 500 на кнопке
        // «Оплатить». Сведение двух оплат в одну было бы ещё хуже: первый
        // получил бы платёж, оплаченный вторым.
        config(['billing.provider' => 'stub']);
        $this->seedPlan();
        $key = (string) Str::uuid();

        $first = $this->actingAs($this->seedUser('A'), 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year', 'idempotency_key' => $key])
            ->assertCreated()
            ->json('data.payment_uuid');

        $second = $this->actingAs($this->seedUser('B'), 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year', 'idempotency_key' => $key])
            ->assertCreated()
            ->json('data.payment_uuid');

        $this->assertNotSame($first, $second);
        $this->assertSame(2, Payment::query()->count());
    }

    public function test_wallet_topup_honours_the_key(): void
    {
        config(['billing.provider' => 'stub']);
        $user = $this->seedUser();
        $key = (string) Str::uuid();

        $first = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/wallet/topup', ['amount' => 500, 'idempotency_key' => $key])
            ->assertCreated()
            ->json('data.payment_uuid');

        $second = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/wallet/topup', ['amount' => 500, 'idempotency_key' => $key])
            ->assertCreated()
            ->json('data.payment_uuid');

        $this->assertSame($first, $second);
        $this->assertSame(1, Payment::query()->where('user_id', $user->id)->count());
    }

    /**
     * У безопасной сделки ключа идемпотентности нет: она не проходит через
     * `PaymentRecorder`. Второе нажатие сдерживает бронь объявления — и до
     * 08.09 она читалась из объекта в памяти, без блокировки строки.
     */
    public function test_second_safe_deal_on_the_same_listing_is_refused(): void
    {
        config(['billing.safe_deal.escrow_provider' => 'wallet']);
        $seller = $this->seedUser('Seller');
        $buyer = $this->seedUser('Buyer');
        app(WalletService::class)->credit($buyer, 500000, WalletTransactionType::Topup, 'test');

        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
        ]);
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Test listing',
            'slug' => 'test-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);

        // Копия объявления, какой её видит второй запрос: прочитана до того,
        // как первый поставил бронь. Именно из-за этой копии два нажатия
        // проходили проверку `assertPurchasable` оба.
        $stale = Listing::query()->whereKey($listing->id)->firstOrFail();
        $this->assertNull($stale->reserved_at);

        $deals = app(SafeDealService::class);
        $deals->create($buyer, $listing, ['accept_terms' => true]);

        $this->expectException(ValidationException::class);
        $deals->create($buyer, $stale, ['accept_terms' => true]);
    }
}
