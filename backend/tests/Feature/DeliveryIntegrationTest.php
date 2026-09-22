<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SellerDeliveryProfile;
use App\Models\Shipment;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Delivery\Services\Carriers\CdekDeliveryAdapter;
use Tests\TestCase;

class DeliveryIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cdek.enabled' => true,
            'cdek.test' => true,
            'cdek.api_url_test' => 'https://api.edu.cdek.ru/v2/',
            'yandex-delivery.enabled' => true,
            'yandex-delivery.token' => 'test-yandex-token',
            'yandex-delivery.api_url' => 'https://b2b.test.yandex.net',
        ]);
    }

    private function sellerAndBuyer(): array
    {
        $seller = User::factory()->create(['status' => UserStatus::Active]);
        $buyer = User::factory()->create(['status' => UserStatus::Active]);

        UserProfile::create(['user_id' => $seller->id, 'display_name' => 'Seller', 'slug' => 'seller-delivery']);
        UserProfile::create(['user_id' => $buyer->id, 'display_name' => 'Buyer', 'slug' => 'buyer-delivery']);

        return [$seller, $buyer];
    }

    private function listing(User $seller): Listing
    {
        $category = ListingCategory::create([
            'name' => 'Parts',
            'slug' => 'parts-delivery',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        return Listing::create([
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Motor for sale',
            'slug' => 'motor-delivery',
            'description' => 'Delivery test listing',
            'price_cents' => 10_000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'delivery_methods' => ['СДЭК', 'Яндекс Доставка'],
            'published_at' => now(),
        ]);
    }

    public function test_seller_can_manage_delivery_profile(): void
    {
        [$seller] = $this->sellerAndBuyer();

        $created = $this->actingAs($seller, 'sanctum')
            ->postJson('/api/v1/users/me/delivery-profile', [
                'provider' => 'cdek',
                'point_type' => 'pickup_point',
                'external_point_id' => 'MSK1',
                'label' => 'ПВЗ Москва',
                'is_default' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.external_point_id', 'MSK1');

        $id = $created->json('data.id');

        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/v1/users/me/delivery-profile')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($seller, 'sanctum')
            ->deleteJson("/api/v1/users/me/delivery-profile/{$id}")
            ->assertOk();
    }

    public function test_yandex_pickup_points_proxy(): void
    {
        Http::fake([
            'b2b.test.yandex.net/api/b2b/platform/pickup-points/list' => Http::response([
                'points' => [
                    ['id' => 'pvz-1', 'name' => 'Test PVZ', 'type' => 'pickup_point'],
                ],
            ]),
        ]);

        [$seller] = $this->sellerAndBuyer();

        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/v1/delivery/yandex/pickup-points?geo_id=213')
            ->assertOk()
            ->assertJsonPath('data.0.id', 'pvz-1');
    }

    public function test_shipment_quote_and_confirm_flow_with_cdek(): void
    {
        Http::fake([
            'api.edu.cdek.ru/v2/oauth/token*' => Http::response([
                'access_token' => 'cdek-token',
                'expires_in' => 3600,
            ]),
            'api.edu.cdek.ru/v2/calculator/tarifflist' => Http::response([
                'tariff_codes' => [
                    ['tariff_code' => 136, 'delivery_sum' => 350.0],
                ],
            ]),
            'api.edu.cdek.ru/v2/orders' => Http::response([
                'entity' => [
                    'uuid' => 'cdek-order-uuid',
                    'cdek_number' => '1234567890',
                    'statuses' => [['code' => 'CREATED']],
                ],
            ]),
        ]);

        [$seller, $buyer] = $this->sellerAndBuyer();
        $listing = $this->listing($seller);

        SellerDeliveryProfile::create([
            'user_id' => $seller->id,
            'provider' => 'cdek',
            'point_type' => 'pickup_point',
            'external_point_id' => 'MSK1',
            'label' => 'Отправка',
            'address' => ['city_code' => 44],
            'is_default' => true,
        ]);

        $shipmentUuid = $this->actingAs($buyer, 'sanctum')
            ->postJson('/api/v1/shipments', [
                'listing_uuid' => $listing->uuid,
                'provider' => 'cdek',
                'destination_point' => [
                    'external_point_id' => 'SPB1',
                    'label' => 'ПВЗ СПб',
                    'city_code' => 137,
                ],
                'weight_kg' => 0.5,
                'dimensions_cm' => ['length' => 20, 'width' => 15, 'height' => 10],
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/shipments/{$shipmentUuid}/quote")
            ->assertOk()
            ->assertJsonPath('data.status', 'quoted')
            ->assertJsonPath('data.delivery_cost_cents', 35000);

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/shipments/{$shipmentUuid}/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', 'created')
            ->assertJsonPath('data.tracking_number', '1234567890');

        $this->assertDatabaseHas('shipments', [
            'uuid' => $shipmentUuid,
            'external_id' => 'cdek-order-uuid',
        ]);
    }

    /**
     * В заказ уходит именно пункт, а не «что-нибудь непустое».
     *
     * Проверка выше гоняет тот же путь и была зелёной всё время, пока на
     * проде не заводилось ни одного отправления: она мокает `/v2/orders`
     * и ни разу не смотрит, что ушло в теле. Смотрим.
     */
    public function test_the_cdek_order_carries_both_points(): void
    {
        Http::fake([
            'api.edu.cdek.ru/v2/oauth/token*' => Http::response(['access_token' => 't', 'expires_in' => 3600]),
            'api.edu.cdek.ru/v2/calculator/tarifflist' => Http::response([
                'tariff_codes' => [['tariff_code' => 136, 'delivery_sum' => 350.0]],
            ]),
            'api.edu.cdek.ru/v2/orders' => Http::response([
                'entity' => ['uuid' => 'u', 'cdek_number' => '1', 'statuses' => [['code' => 'CREATED']]],
            ]),
        ]);

        [$seller, $buyer] = $this->sellerAndBuyer();
        $listing = $this->listing($seller);

        SellerDeliveryProfile::create([
            'user_id' => $seller->id,
            'provider' => 'cdek',
            'point_type' => 'pickup_point',
            'external_point_id' => 'MSK1',
            'label' => 'Отправка',
            'address' => ['city_code' => 44],
            'is_default' => true,
        ]);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson('/api/v1/shipments', [
                'listing_uuid' => $listing->uuid,
                'provider' => 'cdek',
                'destination_point' => ['external_point_id' => 'SPB1', 'city_code' => 137],
                'weight_kg' => 0.5,
                'dimensions_cm' => ['length' => 20, 'width' => 15, 'height' => 10],
            ])->assertCreated()->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')->postJson("/api/v1/shipments/{$uuid}/quote")->assertOk();
        $this->actingAs($seller, 'sanctum')->postJson("/api/v1/shipments/{$uuid}/confirm")->assertOk();

        Http::assertSent(function ($request): bool {
            if ($request->method() !== 'POST' || ! str_ends_with($request->url(), '/v2/orders')) {
                return false;
            }
            $body = $request->data();

            return ($body['shipment_point'] ?? null) === 'MSK1'
                && ($body['delivery_point'] ?? null) === 'SPB1';
        });
    }

    /**
     * Город в source_point не выдаётся за выбранный пункт.
     *
     * Ровно этот снимок — `{"city_code":44,"label":"Москва"}` — лежал у всех
     * девятнадцати отправлений. Непустой, и проверка `!== null` считала его
     * готовым; профиль продавца не читался, заказ уезжал без пункта.
     * Здесь профиля нет вовсе, значит правильный исход — внятный отказ.
     */
    public function test_a_city_only_source_point_does_not_pass_for_a_point(): void
    {
        Http::fake([
            'api.edu.cdek.ru/v2/oauth/token*' => Http::response(['access_token' => 't', 'expires_in' => 3600]),
            'api.edu.cdek.ru/v2/calculator/tarifflist' => Http::response([
                'tariff_codes' => [['tariff_code' => 136, 'delivery_sum' => 350.0]],
            ]),
        ]);

        [$seller, $buyer] = $this->sellerAndBuyer();
        $listing = $this->listing($seller);

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson('/api/v1/shipments', [
                'listing_uuid' => $listing->uuid,
                'provider' => 'cdek',
                'destination_point' => ['external_point_id' => 'SPB1', 'city_code' => 137],
                'weight_kg' => 0.5,
                'dimensions_cm' => ['length' => 20, 'width' => 15, 'height' => 10],
            ])->assertCreated()->json('data.uuid');

        Shipment::query()->where('uuid', $uuid)->update([
            'source_point' => ['city_code' => 44, 'label' => 'Москва'],
        ]);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/shipments/{$uuid}/quote")
            ->assertStatus(422)
            ->assertJsonPath('errors.source_point.0', 'Продавец не указал пункт отправки СДЭК. Добавьте пункт в профиле доставки.');

        Http::assertNotSent(fn ($request): bool => str_ends_with($request->url(), '/v2/orders'));
    }

    /**
     * Нет пункта, но есть адрес — в заказ уходит to_location.
     *
     * Через ручку этот путь сейчас недостижим: `StoreShipmentController`
     * объявляет `destination_point.external_point_id` обязательным, то есть
     * адресную доставку API не принимает вовсе. Поэтому проверяем сам
     * адаптер — иначе проверка утверждала бы работу ручки, которой нет.
     *
     * Это задел под тарифы «от двери», а не живой путь. Раньше ключей
     * `from_location`/`to_location` в теле не было совсем, и такой тариф
     * упал бы тем же `is empty`, что и склад-складской без пункта.
     */
    public function test_an_address_only_end_goes_as_to_location(): void
    {
        Http::fake([
            'api.edu.cdek.ru/v2/oauth/token*' => Http::response(['access_token' => 't', 'expires_in' => 3600]),
            'api.edu.cdek.ru/v2/orders' => Http::response([
                'entity' => ['uuid' => 'u', 'cdek_number' => '1', 'statuses' => [['code' => 'CREATED']]],
            ]),
        ]);

        [$seller, $buyer] = $this->sellerAndBuyer();
        $listing = $this->listing($seller);

        $shipment = Shipment::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'seller_id' => $seller->id,
            'buyer_id' => $buyer->id,
            'provider' => 'cdek',
            'status' => 'quoted',
            'source_point' => ['city_code' => 44, 'external_point_id' => 'MSK1'],
            'destination_point' => ['city_code' => 137, 'address' => 'СПб, Невский, 1'],
            'weight_kg' => 0.5,
            'dimensions_cm' => ['length' => 20, 'width' => 15, 'height' => 10],
            'raw_payload' => ['tariff_code' => '137'],
        ]);

        app(CdekDeliveryAdapter::class)->createShipment($shipment->fresh(['listing', 'seller', 'buyer']));

        Http::assertSent(function ($request): bool {
            if ($request->method() !== 'POST' || ! str_ends_with($request->url(), '/v2/orders')) {
                return false;
            }
            $body = $request->data();

            return ($body['shipment_point'] ?? null) === 'MSK1'
                && ! array_key_exists('delivery_point', $body)
                && ($body['to_location']['address'] ?? null) === 'СПб, Невский, 1'
                && ($body['to_location']['code'] ?? null) === 137;
        });
    }

    /**
     * Ответ на создание профиля совпадает с тем, что легло в базу.
     *
     * `is_active` в теле запроса не передаётся — он объявлен в схеме
     * `default true not null`. Свежесозданный объект отдавал по нему
     * `null`, и ручка сообщала о профиле то, чего в базе нет. Замер
     * 22.09 на проде: ответ `"is_active": null`, строка `t`.
     */
    public function test_a_created_profile_reports_what_the_database_holds(): void
    {
        [$seller] = $this->sellerAndBuyer();

        $ответ = $this->actingAs($seller, 'sanctum')
            ->postJson('/api/v1/users/me/delivery-profile', [
                'provider' => 'cdek',
                'point_type' => 'pickup_point',
                'external_point_id' => 'KSD232',
                'label' => 'Краснодар, Уральская',
                'address' => ['address' => 'Краснодар, ул. Уральская, 75', 'city_code' => 435],
                'meta' => ['city_code' => 435],
                'is_default' => true,
            ])
            ->assertCreated();

        $ответ->assertJsonPath('data.is_active', true);

        $this->assertDatabaseHas('seller_delivery_profiles', [
            'user_id' => $seller->id,
            'external_point_id' => 'KSD232',
            'is_active' => true,
        ]);
    }

    public function test_admin_delivery_stats(): void
    {
        [$seller, $buyer] = $this->sellerAndBuyer();
        $admin = User::factory()->create(['status' => UserStatus::Active, 'role' => UserRole::Owner]);
        $listing = $this->listing($seller);

        Shipment::create([
            'listing_id' => $listing->id,
            'seller_id' => $seller->id,
            'buyer_id' => $buyer->id,
            'provider' => 'cdek',
            'status' => 'quoted',
            'destination_point' => ['external_point_id' => 'SPB1'],
            'delivery_cost_cents' => 25000,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/delivery/stats')
            ->assertOk()
            ->assertJsonPath('data.shipments_total', 1)
            ->assertJsonPath('data.delivery_revenue_cents', 25000);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/delivery/shipments')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
