<?php

namespace Tests\Unit;

use Illuminate\Support\Facades\Http;
use Modules\Billing\Clients\VtbAcquiringClient;
use RuntimeException;
use Tests\TestCase;

class VtbAcquiringClientTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'test-user',
            'billing.vtb.password' => 'test-pass',
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
            'billing.vtb.token' => null,
        ]);
    }

    public function test_register_do_posts_form_and_returns_form_url(): void
    {
        Http::fake([
            'vtb.test/payment/rest/register.do' => Http::response([
                'errorCode' => '0',
                'orderId' => 'vtb-order-1',
                'formUrl' => 'https://vtb.test/pay/form',
            ]),
        ]);

        $result = app(VtbAcquiringClient::class)->registerOrder([
            'orderNumber' => 'deal-uuid',
            'amount' => 105000,
            'returnUrl' => 'https://modelizmclub.ru/return',
        ]);

        $this->assertSame('vtb-order-1', $result['orderId']);
        $this->assertSame('https://vtb.test/pay/form', $result['formUrl']);

        Http::assertSent(function ($request): bool {
            return str_ends_with($request->url(), 'register.do')
                && $request['userName'] === 'test-user'
                && $request['orderNumber'] === 'deal-uuid'
                && (int) $request['amount'] === 105000;
        });
    }

    public function test_register_pre_auth_deposit_and_reverse(): void
    {
        Http::fake([
            'vtb.test/payment/rest/registerPreAuth.do' => Http::response([
                'errorCode' => 0,
                'orderId' => 'hold-1',
                'formUrl' => 'https://vtb.test/pay/hold',
            ]),
            'vtb.test/payment/rest/deposit.do' => Http::response(['errorCode' => '0']),
            'vtb.test/payment/rest/reverse.do' => Http::response(['errorCode' => '0']),
        ]);

        $client = app(VtbAcquiringClient::class);

        $hold = $client->registerPreAuth([
            'orderNumber' => 'deal-uuid',
            'amount' => 105000,
            'returnUrl' => 'https://modelizmclub.ru/return',
        ]);
        $this->assertSame('hold-1', $hold['orderId']);

        $client->deposit('hold-1', 105000);
        $client->reverse('hold-1');

        Http::assertSent(fn ($request): bool => str_ends_with($request->url(), 'registerPreAuth.do'));
        Http::assertSent(function ($request): bool {
            return str_ends_with($request->url(), 'deposit.do')
                && $request['orderId'] === 'hold-1'
                && (int) $request['amount'] === 105000;
        });
        Http::assertSent(function ($request): bool {
            return str_ends_with($request->url(), 'reverse.do')
                && $request['orderId'] === 'hold-1';
        });
    }

    public function test_rbs_error_code_throws(): void
    {
        Http::fake([
            'vtb.test/payment/rest/register.do' => Http::response([
                'errorCode' => '5',
                'errorMessage' => 'Access denied',
            ]),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Access denied');

        app(VtbAcquiringClient::class)->registerOrder(['orderNumber' => 'x', 'amount' => 100]);
    }

    public function test_order_status_helpers(): void
    {
        $this->assertTrue(VtbAcquiringClient::isAuthorizedStatus(['orderStatus' => 1]));
        $this->assertTrue(VtbAcquiringClient::isCapturedStatus(['orderStatus' => ['orderStatus' => 2]]));
        $this->assertTrue(VtbAcquiringClient::isPaidStatus(['orderStatus' => 2]));
        $this->assertSame(3, VtbAcquiringClient::orderStatus(['orderStatus' => 3]));
    }
}
