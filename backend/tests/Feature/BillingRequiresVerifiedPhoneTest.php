<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\DeliveryMethod;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Телефон в денежном контуре: только вывод средств. Решение З2 от 09.10.
 *
 * Тест заведён 07.09 по другому правилу. Тогда группа Billing была закрыта
 * только `auth:sanctum`, а лента и объявления требовали ещё и `verified`, и
 * расхождение дало настоящий дефект: учётка без подтверждённого телефона
 * получала 403 на лайк и при этом создавала безопасную сделку, бронируя
 * чужой лот. Правило выровняли в сторону строгости — телефон стал нужен на
 * всех денежных операциях.
 *
 * **09.10 владелец выровнял его в другую сторону.** Решение З2: «Подтверждённый
 * телефон требуется только для публикации объявления и вывода средств».
 * Пополнение, платёж, отмена подписки и старт безопасной сделки — это деньги
 * **на** площадку и в сторону продавца; телефон они больше не требуют.
 *
 * Дефект 07.09 от этого не возвращается: он был в расхождении между лайком и
 * сделкой, а не в самом требовании. Теперь обе стороны согласны — телефона не
 * требует ни то, ни другое.
 *
 * Что проверяется здесь после З2:
 *
 * - вывод средств без телефона — отказ с кодом `phone_not_verified`;
 * - пополнение, платёж, отмена подписки, старт сделки — **не** упираются в
 *   телефон (отвечают своей проверкой данных, а не 403);
 * - чтения открыты, как и раньше;
 * - вебхуки провайдеров не проходят ни вход, ни подтверждения.
 */
class BillingRequiresVerifiedPhoneTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.listing_payment_enabled'],
            ['value' => ['enabled' => false], 'group' => 'feature'],
        );

        DeliveryMethod::query()->firstOrCreate(
            ['code' => 'pickup'],
            ['name' => 'Самовывоз', 'is_active' => true, 'is_integrated' => false, 'sort_order' => 5],
        );
    }

    private function user(bool $phoneVerified): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => $phoneVerified ? now() : null,
        ]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'User '.$user->id,
            'slug' => 'user-'.$user->id.'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function listing(User $seller): Listing
    {
        $category = ListingCategory::query()->create([
            'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
        ]);

        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Модель на продажу',
            'slug' => 'test-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
            'delivery_methods' => ['Самовывоз'],
        ]);
    }

    /**
     * Денежные операции, которые телефона НЕ требуют. Решение З2.
     *
     * Все они отвечают своей проверкой данных (422) или «нет подписки» (404) —
     * то есть доходят до собственной логики, а не упираются в подтверждение
     * номера. Проверяется именно это: код ответа не 403 и в теле нет
     * `phone_not_verified`.
     *
     * @return array<string, array{string, string}>
     */
    public static function moneyRoutesWithoutPhone(): array
    {
        return [
            'пополнение' => ['POST', '/api/v1/wallet/topup'],
            'платёж' => ['POST', '/api/v1/payments'],
            'отмена подписки' => ['POST', '/api/v1/users/me/subscription/cancel'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('moneyRoutesWithoutPhone')]
    public function test_money_routes_other_than_withdrawal_do_not_ask_for_a_phone(
        string $method,
        string $uri,
    ): void {
        $ответ = $this->actingAs($this->user(false), 'sanctum')->json($method, $uri);

        $this->assertNotSame(
            403,
            $ответ->status(),
            $uri.' упирается в подтверждение, хотя по решению З2 не должен: '.$ответ->getContent(),
        );
        $this->assertNotSame('phone_not_verified', $ответ->json('code'), $uri);
    }

    public function test_withdrawal_still_refuses_an_unverified_phone(): void
    {
        $this->actingAs($this->user(false), 'sanctum')
            ->json('POST', '/api/v1/wallet/withdraw')
            ->assertStatus(403)
            ->assertJsonPath('code', 'phone_not_verified');
    }

    /**
     * Безопасная сделка стартует без подтверждённого телефона — З2.
     *
     * Здесь раньше проверялся отказ. Главное наблюдение 07.09 при этом
     * остаётся проверяемым и проверяется: лот не бронируется, если сделка не
     * состоялась. Только причина теперь другая — не телефон, а пустой баланс.
     */
    public function test_safe_deal_does_not_ask_for_a_phone_but_still_needs_money(): void
    {
        $seller = $this->user(true);
        $listing = $this->listing($seller);

        $ответ = $this->actingAs($this->user(false), 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true]);

        $this->assertNotSame(403, $ответ->status(), $ответ->getContent());
        $this->assertNotSame('phone_not_verified', $ответ->json('code'));

        // Лот не забронирован: сделка не состоялась, и причина названа.
        $this->assertNull($listing->fresh()->reserved_at);
    }

    public function test_a_verified_buyer_still_creates_a_safe_deal(): void
    {
        $seller = $this->user(true);
        $listing = $this->listing($seller);
        $buyer = $this->user(true);
        app(\Modules\Billing\Services\WalletService::class)
            ->credit($buyer, 105000, \App\Enums\WalletTransactionType::Topup, 'test');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated();

        $this->assertNotNull($listing->fresh()->reserved_at);
    }

    public function test_reads_stay_open_for_an_unverified_phone(): void
    {
        // Ради чего разделены группы: сессия собирается на каждой странице и
        // упирается в подписку. 403 отсюда открывал окно верификации поверх
        // всего сайта, включая оформление и смену пароля.
        $user = $this->user(false);

        $this->actingAs($user, 'sanctum')->getJson('/api/v1/users/me/subscription')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/wallet')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/wallet/transactions')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/safe-deals')->assertOk();
    }

    public function test_a_verified_user_still_reads_wallet_and_subscription(): void
    {
        $user = $this->user(true);

        $this->actingAs($user, 'sanctum')->getJson('/api/v1/wallet')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/users/me/subscription')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/safe-deals')->assertOk();
    }

    public function test_provider_webhooks_stay_open(): void
    {
        /*
         * У вебхука нет пользователя: он не должен попасть под verified.
         *
         * Раньше это проверялось кодом ответа — «не 401 и не 403». Признак
         * перестал годиться 26.09, когда вебхук доставки закрыли общим
         * секретом: теперь 401 — его собственный законный ответ на неверную
         * подпись, и по коду уже не отличить «требует входа» от «не та
         * подпись». Смотрим прямо на middleware маршрута.
         */
        $route = collect(Route::getRoutes()->getRoutes())
            ->first(fn ($r) => $r->uri() === 'api/v1/safe-deals/webhooks/delivery');

        $this->assertNotNull($route, 'маршрут вебхука доставки не найден');

        $middleware = $route->gatherMiddleware();

        /*
         * Сравнение по началу строки, а не точное: `auth`, `auth:web`,
         * `auth.session` — всё это вход, и точное сравнение с `auth:sanctum`
         * их пропускало. FQCN `Authenticate::class` в списке не проверяется:
         * в маршрутах этого проекта его не пишут, а написали бы — он пришёл
         * бы с суффиксом guard, и точное сравнение всё равно бы не поймало.
         */
        foreach ($middleware as $слой) {
            $this->assertFalse(
                str_starts_with($слой, 'auth'),
                "вебхук не должен проходить через вход: {$слой}",
            );
            $this->assertStringNotContainsString(
                'verified',
                $слой,
                "вебхук не должен требовать подтверждённый телефон: {$слой}",
            );
        }
    }
}
