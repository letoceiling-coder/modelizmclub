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
use Tests\TestCase;

/**
 * Денежный контур требует подтверждённого телефона.
 *
 * До 07.09 группа маршрутов Billing была закрыта только `auth:sanctum`, тогда
 * как лента, сообщества и объявления требовали ещё и `verified`. Замер на
 * проде: учётка с неподтверждённым телефоном получала 403 на лайк поста и при
 * этом создавала безопасную сделку, забронировав чужой лот.
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
     * Только операции. Чтения намеренно открыты: `fetchSession` на фронте
     * блокируется на `GET users/me/subscription`, а `GuestAccessProvider`
     * открывает окно верификации по коду `phone_not_verified` независимо от
     * страницы. Закрыв чтения, я 07.09 получил модалку поверх каждой
     * страницы сайта — см. test_reads_stay_open_for_an_unverified_phone.
     *
     * @return list<array{string, string}>
     */
    public static function moneyRoutes(): array
    {
        return [
            'пополнение' => ['POST', '/api/v1/wallet/topup'],
            'вывод' => ['POST', '/api/v1/wallet/withdraw'],
            'платёж' => ['POST', '/api/v1/payments'],
            'отмена подписки' => ['POST', '/api/v1/users/me/subscription/cancel'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('moneyRoutes')]
    public function test_money_routes_refuse_an_unverified_phone(string $method, string $uri): void
    {
        $this->actingAs($this->user(false), 'sanctum')
            ->json($method, $uri)
            ->assertStatus(403)
            ->assertJsonPath('code', 'phone_not_verified');
    }

    public function test_safe_deal_cannot_be_created_without_a_verified_phone(): void
    {
        $seller = $this->user(true);
        $listing = $this->listing($seller);

        $this->actingAs($this->user(false), 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertStatus(403)
            ->assertJsonPath('code', 'phone_not_verified');

        // Главное: лот не забронирован. Именно это ломало витрину на проде.
        $this->assertNull($listing->fresh()->reserved_at);
    }

    public function test_a_verified_buyer_still_creates_a_safe_deal(): void
    {
        $seller = $this->user(true);
        $listing = $this->listing($seller);
        $buyer = $this->user(true);
        app(\Modules\Billing\Services\WalletService::class)
            ->credit($buyer, 100000, \App\Enums\WalletTransactionType::Topup, 'test');

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
        // У вебхука нет пользователя: он не должен попасть под verified.
        $status = $this->postJson('/api/v1/safe-deals/webhooks/delivery', [])->getStatusCode();

        $this->assertNotSame(401, $status, 'вебхук не должен требовать вход');
        $this->assertNotSame(403, $status, 'вебхук не должен требовать подтверждённый телефон');
    }
}
