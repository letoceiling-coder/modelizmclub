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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;
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
     * Успехом считается не код ответа, а перечитанный список: последний
     * `GET` в череде ниже — это проверка `убедиться()`, и без неё тест
     * подтверждал бы только то, что запрос ушёл.
     */
    public function test_webhook_registration_is_idempotent(): void
    {
        config(['app.url' => 'https://modelizmclub.ru']);
        $url = 'https://modelizmclub.ru/api/v1/webhooks/cdek/order-status';

        Http::fake([
            '*/v2/oauth/token*' => Http::response(['access_token' => 't', 'expires_in' => 3600]),
            '*/v2/webhooks' => Http::sequence()
                ->push(['entity' => []])
                ->push(['requests' => [['state' => 'SUCCESSFUL', 'errors' => []]]])
                ->push(['entity' => [['type' => 'ORDER_STATUS', 'url' => $url, 'uuid' => 'new']]]),
        ]);

        $this->artisan('cdek:register-webhook')->assertSuccessful();

        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && str_contains($request->url(), '/webhooks')
            && ($request->data()['url'] ?? null) === $url
            && ($request->data()['type'] ?? null) === 'ORDER_STATUS');
    }

    /**
     * СДЭК отказал внутри ответа с кодом 200 — это отказ, а не успех.
     *
     * `decode()` бросает только на 4xx/5xx, поэтому `state=INVALID` при
     * HTTP 200 проходил насквозь и команда печатала «Готово».
     */
    public function test_webhook_registration_fails_on_invalid_state(): void
    {
        config(['app.url' => 'https://modelizmclub.ru']);

        Http::fake([
            '*/v2/oauth/token*' => Http::response(['access_token' => 't', 'expires_in' => 3600]),
            '*/v2/webhooks' => Http::sequence()
                ->push(['entity' => []])
                ->push(['requests' => [[
                    'state' => 'INVALID',
                    'errors' => [['code' => 'v2_entity_invalid', 'message' => 'url is not reachable']],
                ]]]),
        ]);

        $this->artisan('cdek:register-webhook')
            ->expectsOutputToContain('url is not reachable')
            ->assertFailed();
    }

    /**
     * Случай 22.09: ответ успешный, а в списке осталась прежняя подписка.
     *
     * Список перечитывается трижды — у СДЭК он обновляется не сразу, и
     * одного чтения мало, чтобы отличить задержку от незаведённой подписки.
     * Здесь прежняя подписка держится во всех трёх ответах: это уже не
     * задержка, и команда не должна отчитываться успехом.
     */
    public function test_webhook_registration_fails_when_list_did_not_change(): void
    {
        config(['app.url' => 'https://api.modelizmclub.ru']);
        Sleep::fake();
        $чужой = 'https://modelizmclub.ru/api/v1/webhooks/cdek/order-status';
        $прежняя = ['entity' => [['type' => 'ORDER_STATUS', 'url' => $чужой, 'uuid' => 'old']]];

        Http::fake([
            '*/v2/oauth/token*' => Http::response(['access_token' => 't', 'expires_in' => 3600]),
            '*/v2/webhooks*' => Http::sequence()
                ->push($прежняя)
                ->push([])
                ->push(['requests' => [['state' => 'SUCCESSFUL', 'errors' => []]]])
                ->push($прежняя)
                ->push($прежняя)
                ->push($прежняя),
        ]);

        $this->artisan('cdek:register-webhook')
            ->expectsOutputToContain($чужой)
            ->assertFailed();
    }

    /**
     * Задержка списка — не отказ: со второго чтения подписка видна.
     *
     * Именно это, похоже, и было на проде 22.09: прогон отработал, список
     * ещё показывал прежнюю подписку, а позже — уже новую. Признать такое
     * провалом значит послать человека чинить работающее.
     */
    public function test_webhook_registration_survives_a_lagging_list(): void
    {
        config(['app.url' => 'https://api.modelizmclub.ru']);
        Sleep::fake();
        $чужой = 'https://modelizmclub.ru/api/v1/webhooks/cdek/order-status';
        $нужный = 'https://api.modelizmclub.ru/api/v1/webhooks/cdek/order-status';

        Http::fake([
            '*/v2/oauth/token*' => Http::response(['access_token' => 't', 'expires_in' => 3600]),
            '*/v2/webhooks*' => Http::sequence()
                ->push(['entity' => [['type' => 'ORDER_STATUS', 'url' => $чужой, 'uuid' => 'old']]])
                ->push([])
                ->push(['requests' => [['state' => 'SUCCESSFUL', 'errors' => []]]])
                ->push(['entity' => [['type' => 'ORDER_STATUS', 'url' => $чужой, 'uuid' => 'old']]])
                ->push(['entity' => [['type' => 'ORDER_STATUS', 'url' => $нужный, 'uuid' => 'new']]]),
        ]);

        $this->artisan('cdek:register-webhook')
            ->expectsOutputToContain($нужный)
            ->assertSuccessful();
    }

    /** На http СДЭК не стучится — лучше отказать, чем завести мёртвую подписку. */
    public function test_webhook_registration_refuses_plain_http(): void
    {
        $this->artisan('cdek:register-webhook', ['--url' => 'http://modelizmclub.ru/hook'])
            ->assertFailed();
    }

    /**
     * Первое настоящее уведомление видно сразу, а не раскопками в журналах.
     *
     * Что именно проверяется: отметка одноразовая — первое уведомление
     * уходит в `warning`, следующее в `info`. Иначе «первое» затеряется
     * среди остальных ровно так же, как терялось молчание до 22.09.
     */
    public function test_first_cdek_webhook_is_logged_loudly_once(): void
    {
        Cache::forget('cdek:webhook:first-seen-at');
        Log::spy();

        $тело = ['uuid' => 'нет-такого-отправления', 'status' => ['code' => 'RECEIVED_AT_SHIPMENT_WAREHOUSE']];

        $this->postJson('/api/v1/webhooks/cdek/order-status', $тело)->assertOk();
        $this->postJson('/api/v1/webhooks/cdek/order-status', $тело)->assertOk();

        Log::shouldHaveReceived('warning')
            ->with('СДЭК: пришло ПЕРВОЕ уведомление о статусе отправления', \Mockery::any())
            ->once();

        Log::shouldHaveReceived('info')
            ->with('СДЭК: уведомление о статусе отправления', \Mockery::any())
            ->once();
    }

    /**
     * Пустое тело отметку не сжигает.
     *
     * На этот адрес шлёт кто угодно: свой же `curl` при проверке связи —
     * в журналах nginx их 150 штук, — чужой сканер. Посчитать такое
     * «первым уведомлением от СДЭК» значит потерять единственный сигнал.
     */
    public function test_an_empty_body_does_not_burn_the_first_marker(): void
    {
        Cache::forget('cdek:webhook:first-seen-at');
        Log::spy();

        $this->postJson('/api/v1/webhooks/cdek/order-status', [])->assertOk();

        $this->assertNull(
            Cache::get('cdek:webhook:first-seen-at'),
            'отметка сгорела на пустом теле — первое настоящее уведомление уже не будет первым',
        );

        Log::shouldNotHaveReceived('warning', ['СДЭК: пришло ПЕРВОЕ уведомление о статусе отправления', \Mockery::any()]);
    }
}
