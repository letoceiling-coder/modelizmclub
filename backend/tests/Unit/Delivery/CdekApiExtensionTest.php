<?php

namespace Tests\Unit\Delivery;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Modules\Delivery\Exceptions\CdekApiException;
use Modules\Delivery\Services\CdekApiExtension;
use Modules\Delivery\Services\CdekTokenCache;
use Tests\TestCase;

class CdekApiExtensionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cdek.test' => true,
            'cdek.api_url_test' => 'https://api.edu.cdek.ru/v2/',
            'cdek.timeout' => 5.0,
            'cdek.token_cache_key' => 'cdek:test:token',
        ]);

        Cache::flush();
    }

    public function test_list_orders_uses_bearer_token(): void
    {
        Http::fake([
            'api.edu.cdek.ru/v2/oauth/token*' => Http::response([
                'access_token' => 'test-token',
                'expires_in' => 3600,
                'token_type' => 'bearer',
            ]),
            'api.edu.cdek.ru/v2/orders*' => Http::response([
                ['uuid' => 'order-1', 'cdek_number' => 123],
            ]),
        ]);

        $extension = new CdekApiExtension(new CdekTokenCache(Cache::store()));
        $result = $extension->listOrders(['date' => '2026-07-06']);

        $this->assertCount(1, $result);
        $this->assertSame('order-1', $result[0]['uuid']);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.edu.cdek.ru/v2/orders?date=2026-07-06'
                && $request->hasHeader('Authorization', 'Bearer test-token');
        });
    }

    public function test_create_prealert_posts_json_payload(): void
    {
        Http::fake([
            'api.edu.cdek.ru/v2/oauth/token*' => Http::response([
                'access_token' => 'tok',
                'expires_in' => 3600,
            ]),
            'api.edu.cdek.ru/v2/prealert' => Http::response([
                'entity' => ['uuid' => 'prealert-uuid'],
            ]),
        ]);

        $extension = new CdekApiExtension(new CdekTokenCache(Cache::store()));
        $payload = [
            'planned_date' => '2026-07-10',
            'shipment_point' => 'MSK1',
            'orders' => [['order_uuid' => 'abc']],
        ];

        $result = $extension->createPrealert($payload);

        $this->assertSame('prealert-uuid', $result['entity']['uuid']);

        Http::assertSent(function ($request) use ($payload) {
            return $request->url() === 'https://api.edu.cdek.ru/v2/prealert'
                && $request['planned_date'] === $payload['planned_date'];
        });
    }

    public function test_api_error_throws_cdek_exception(): void
    {
        Http::fake([
            'api.edu.cdek.ru/v2/oauth/token*' => Http::response([
                'access_token' => 'tok',
                'expires_in' => 3600,
            ]),
            'api.edu.cdek.ru/v2/intakes*' => Http::response(['errors' => [['message' => 'fail']]], 422),
        ]);

        $extension = new CdekApiExtension(new CdekTokenCache(Cache::store()));

        $this->expectException(CdekApiException::class);
        $extension->listIntakes();
    }
}
