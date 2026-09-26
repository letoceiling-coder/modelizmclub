<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\ShipmentStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SafeDeal;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Уведомление СДЭК — повод перечитать статус, а не источник статуса.
 *
 * До 26.09 контроллер брал `status.code` из тела, если тот там был, и
 * перечитывал у СДЭК только когда статуса не было. Дальше
 * `applyWebhookUpdate` → `syncFromShipment` → `markDelivered` заводил
 * `auto_release_at`, и через `auto_release_days` деньги уходили продавцу.
 *
 * Подписи у колбэков СДЭК нет, адрес открыт и намеренно исключён из общего
 * лимита. Ключи отбора — трек-номер и `external_id`: оба отдаются обеим
 * сторонам в `ShipmentResource`, трек ещё и напечатан на этикетке. То есть
 * отметить чужую посылку доставленной мог кто угодно, без всякого входа.
 *
 * Найдено ревью правки соседнего вебхука доставки 26.09: та правка закрыла
 * один путь из двух, и этот был шире — у него есть живой настроенный
 * провайдер, поэтому просто отключить его нельзя.
 */
class CdekWebhookDoesNotTrustBodyTest extends TestCase
{
    use RefreshDatabase;

    private const ТРЕК = '1234567890';

    private const ВНЕШНИЙ = 'cdek-external-1';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cdek.enabled' => true,
            'cdek.test' => true,
            'cdek.api_url_test' => 'https://api.edu.cdek.ru/v2/',
        ]);
    }

    private function сделкаВПути(): SafeDeal
    {
        $seller = User::factory()->create(['status' => UserStatus::Active]);
        $buyer = User::factory()->create(['status' => UserStatus::Active]);

        $deal = SafeDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount_kopecks' => 100_000,
            'platform_fee_kopecks' => 5_000,
            'seller_payout_kopecks' => 95_000,
            'status' => SafeDealStatus::Shipped,
            'tracking_number' => self::ТРЕК,
            'delivery_method' => 'СДЭК',
            'shipped_at' => now()->subDay(),
        ]);

        $category = ListingCategory::create([
            'name' => 'Двигатели',
            'slug' => 'motors-cdek-'.uniqid(),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $listing = Listing::create([
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Мотор',
            'slug' => 'motor-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 100_000,
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);

        $shipment = Shipment::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'safe_deal_id' => $deal->id,
            'seller_id' => $seller->id,
            'buyer_id' => $buyer->id,
            'provider' => 'cdek',
            'destination_point' => ['code' => 'MSK1', 'address' => 'Москва, пункт выдачи'],
            'status' => ShipmentStatus::InTransit,
            'tracking_number' => self::ТРЕК,
            'external_id' => self::ВНЕШНИЙ,
            'external_status' => 'RECEIVED_AT_SHIPMENT_WAREHOUSE',
        ]);

        $deal->update(['shipment_id' => $shipment->id]);

        return $deal->fresh();
    }

    /** Ответ СДЭК на перечитывание заказа. */
    private function ответСдэк(string $код): void
    {
        Http::fake([
            '*/v2/oauth/token*' => Http::response(['access_token' => 't', 'expires_in' => 3600]),
            '*/v2/orders*' => Http::response([
                'entity' => [
                    'cdek_number' => self::ТРЕК,
                    'statuses' => [['code' => $код]],
                ],
            ]),
        ]);
    }

    public function test_подделанное_доставлено_в_теле_не_доводит_сделку_до_выплаты(): void
    {
        $deal = $this->сделкаВПути();

        // СДЭК на перечитывание отвечает, что посылка ещё в пути.
        $this->ответСдэк('RECEIVED_AT_SHIPMENT_WAREHOUSE');

        $this->postJson('/api/v1/webhooks/cdek/order-status', [
            'cdek_number' => self::ТРЕК,
            'status' => ['code' => 'DELIVERED'],
        ])->assertOk();

        $свежая = $deal->fresh();

        $this->assertSame(
            SafeDealStatus::Shipped,
            $свежая->status,
            'статус из тела уведомления не должен двигать сделку',
        );
        $this->assertNull(
            $свежая->auto_release_at,
            'авто-выплата не должна заводиться по статусу из тела уведомления',
        );
    }

    public function test_доставку_подтверждает_перечитанный_у_сдэк_статус(): void
    {
        $deal = $this->сделкаВПути();

        // СДЭК подтверждает доставку — законный путь должен работать.
        $this->ответСдэк('DELIVERED');

        $this->postJson('/api/v1/webhooks/cdek/order-status', [
            'cdek_number' => self::ТРЕК,
            'status' => ['code' => 'RECEIVED_AT_SHIPMENT_WAREHOUSE'],
        ])->assertOk();

        $свежая = $deal->fresh();

        $this->assertSame(
            SafeDealStatus::Delivered,
            $свежая->status,
            'перечитанный у СДЭК статус должен доводить сделку до доставленной',
        );
        $this->assertNotNull(
            $свежая->auto_release_at,
            'после подтверждённой доставки должен заводиться срок авто-выплаты',
        );
    }
}
