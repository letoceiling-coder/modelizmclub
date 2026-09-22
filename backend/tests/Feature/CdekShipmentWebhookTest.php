<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserStatus;
use App\Events\UserRealtimeEvent;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SafeDeal;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Статус отправления доезжает до обеих сторон сделки без перезагрузки.
 *
 * Посылка едет своим чередом — принята, в пути, ждёт в пункте, вручена, — и
 * всё это время шаг сделки остаётся «отправлено». До 22.09 полоса доставки
 * обновлялась только перезагрузкой страницы, притом что статусы приезжают
 * уведомлениями СДЭК сами.
 */
class CdekShipmentWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake([UserRealtimeEvent::class]);
    }

    private function человек(): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'U',
            'slug' => 'u-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function сделка(User $buyer, User $seller): SafeDeal
    {
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => ListingCategory::query()->create([
                'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
            ])->id,
            'title' => 'Лот',
            'slug' => 'lot-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
        ]);

        return SafeDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount_kopecks' => 100000,
            'platform_fee_kopecks' => 5000,
            'seller_payout_kopecks' => 95000,
            'currency' => 'RUB',
            'status' => SafeDealStatus::Shipped,
            'delivery_status' => 'in_transit',
        ]);
    }

    /** @return list<array{kind: string, uuid: string, status: string|null}> */
    private function событияДля(User $user): array
    {
        return Event::dispatched(UserRealtimeEvent::class)
            ->map(fn (array $args): UserRealtimeEvent => $args[0])
            ->filter(fn (UserRealtimeEvent $e): bool => $e->userUuid === $user->uuid
                && $e->type === 'object.updated')
            ->map(fn (UserRealtimeEvent $e): array => [
                'kind' => $e->payload['kind'],
                'uuid' => $e->payload['uuid'],
                'status' => $e->payload['status'],
            ])
            ->values()
            ->all();
    }

    /**
     * Шаг сделки не менялся — событие всё равно уходит.
     *
     * Проверка именно на это: «сделка сменила статус» здесь ложно, а человек
     * на странице должен увидеть новую отметку доставки.
     */
    public function test_delivery_status_alone_reaches_both_sides(): void
    {
        $buyer = $this->человек();
        $seller = $this->человек();
        $deal = $this->сделка($buyer, $seller);

        $deal->forceFill(['delivery_status' => 'at_pickup'])->save();

        $this->assertFalse($deal->wasChanged('status'), 'шаг сделки не менялся — иначе проверка ни о чём');

        $ожидаем = [['kind' => 'deal', 'uuid' => $deal->uuid, 'status' => 'shipped']];
        $this->assertSame($ожидаем, $this->событияДля($buyer));
        $this->assertSame($ожидаем, $this->событияДля($seller));
    }

    /** Трек-номер появляется не при оформлении, а когда перевозчик завёл заказ. */
    public function test_tracking_number_reaches_both_sides(): void
    {
        $buyer = $this->человек();
        $seller = $this->человек();
        $deal = $this->сделка($buyer, $seller);

        $deal->forceFill(['tracking_number' => '1234567890'])->save();

        $this->assertNotSame([], $this->событияДля($buyer));
        $this->assertNotSame([], $this->событияДля($seller));
    }

    /** Правка, которой человек не видит, экран не дёргает. */
    public function test_an_invisible_change_says_nothing(): void
    {
        $buyer = $this->человек();
        $seller = $this->человек();
        $deal = $this->сделка($buyer, $seller);

        $deal->forceFill(['hold_expires_at' => now()->addDay()])->save();

        $this->assertSame([], $this->событияДля($buyer));
        $this->assertSame([], $this->событияДля($seller));
    }

    /**
     * Подписка на уведомления заводится и не плодится.
     *
     * Адрес существовал с 25.08, но СДЭК о нём не знал: подписки никто не
     * создавал, и статусы приезжали только пятнадцатиминутным опросом.
     */
    public function test_webhook_registration_is_idempotent(): void
    {
        config(['app.url' => 'https://modelizmclub.ru']);
        $url = 'https://modelizmclub.ru/api/v1/webhooks/cdek/order-status';

        Http::fake([
            '*/v2/oauth/token*' => Http::response(['access_token' => 't', 'expires_in' => 3600]),
            '*/v2/webhooks' => Http::sequence()
                ->push(['entity' => []])
                ->push(['entity' => ['uuid' => 'new']]),
        ]);

        $this->artisan('cdek:register-webhook')->assertSuccessful();

        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && str_contains($request->url(), '/webhooks')
            && ($request->data()['url'] ?? null) === $url
            && ($request->data()['type'] ?? null) === 'ORDER_STATUS');
    }

    /** На http СДЭК не стучится — лучше отказать, чем завести мёртвую подписку. */
    public function test_webhook_registration_refuses_plain_http(): void
    {
        $this->artisan('cdek:register-webhook', ['--url' => 'http://modelizmclub.ru/hook'])
            ->assertFailed();
    }
}
