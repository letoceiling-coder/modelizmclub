<?php

namespace Tests\Unit;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Modules\Billing\Clients\VtbPayoutOAuthClient;
use Modules\Billing\Clients\VtbSbpPayoutClient;
use RuntimeException;
use Tests\TestCase;

class VtbSbpPayoutClientTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'billing.vtb_payout.enabled' => true,
            'billing.vtb_payout.oauth_url' => 'https://epa-ift-sbp.vtb.ru/passport/oauth2/token',
            'billing.vtb_payout.api_url' => 'https://test3.api.vtb.ru:8443/openapi/smb/efcp',
            'billing.vtb_payout.client_id' => 'EXT.CMM.abc-id@ext.vtb.ru',
            'billing.vtb_payout.client_secret' => 'secret',
            'billing.vtb_payout.merchant_authorization' => 'merchant-uuid',
            'billing.vtb_payout.source_system_id' => 'modelizmclub',
        ]);

        Cache::forget(VtbPayoutOAuthClient::CACHE_KEY);
    }

    public function test_oauth_token_is_cached_and_ibm_client_id_is_normalized(): void
    {
        Http::fake([
            'epa-ift-sbp.vtb.ru/passport/oauth2/token' => Http::response([
                'access_token' => 'tok-1',
                'expires_in' => 179,
                'token_type' => 'Bearer',
            ]),
            'test3.api.vtb.ru:8443/openapi/smb/efcp/sbp-gateway/v1/dictionary/banks' => Http::response([
                ['member_id' => '100000000005', 'member_name_rus' => 'ВТБ'],
            ]),
        ]);

        $client = app(VtbSbpPayoutClient::class);
        $client->dictionaryBanks();
        $client->dictionaryBanks();

        Http::assertSentCount(3);
        Http::assertSent(function ($request): bool {
            return str_contains($request->url(), 'oauth2/token')
                && ! $request->hasHeader('X-IBM-Client-Id')
                && $request['grant_type'] === 'client_credentials'
                && $request['client_id'] === 'EXT.CMM.abc-id@ext.vtb.ru';
        });
        Http::assertSent(function ($request): bool {
            return str_contains($request->url(), 'dictionary/banks')
                && $request->hasHeader('Authorization', 'Bearer tok-1')
                && $request->hasHeader('X-IBM-Client-Id', 'ext.cmm.abc-id')
                && $request->hasHeader('Merchant-Authorization', 'merchant-uuid')
                && $request->hasHeader('Source-System-Id', 'modelizmclub');
        });
    }

    public function test_b2c_pay_check_confirm_and_status(): void
    {
        Http::fake([
            'epa-ift-sbp.vtb.ru/passport/oauth2/token' => Http::response([
                'access_token' => 'tok-1',
                'expires_in' => 179,
                'token_type' => 'Bearer',
            ]),
            'test3.api.vtb.ru:8443/openapi/smb/efcp/sbp-gateway/v1/b2c_pay/check_accept_transaction' => Http::response([
                'requestId' => 'req-1',
                'state' => 'PROCESSING',
                'amount' => 100.35,
            ]),
            'test3.api.vtb.ru:8443/openapi/smb/efcp/sbp-gateway/v1/b2c_pay/status_transaction' => Http::response([
                'requestId' => 'req-1',
                'state' => 'APPROVED',
                'customerPam' => 'Иван И.',
            ]),
            'test3.api.vtb.ru:8443/openapi/smb/efcp/sbp-gateway/v1/b2c_pay/confirm_transaction' => Http::response([
                'requestId' => 'req-1',
                'state' => 'CONFIRMED',
            ]),
        ]);

        $client = app(VtbSbpPayoutClient::class);

        $check = $client->checkAcceptTransaction(
            'req-1',
            '79001234567',
            10035,
            '100000000005',
            'Иванов Иван Иванович',
            'Выплата по безопасной сделке',
        );
        $this->assertSame('PROCESSING', $check['state']);

        $status = $client->statusTransaction('req-1');
        $this->assertSame('APPROVED', $status['state']);

        $confirm = $client->confirmTransaction('req-1', VtbSbpPayoutClient::CONFIRM_OK);
        $this->assertSame('CONFIRMED', $confirm['state']);

        Http::assertSent(function ($request): bool {
            if (! str_contains($request->url(), 'check_accept_transaction')) {
                return false;
            }

            $data = $request->data();

            return $data['requestId'] === 'req-1'
                && $data['phone'] === '79001234567'
                && $data['amount'] === 100.35
                && $data['bankId'] === '100000000005'
                && $data['fullName'] === 'Иванов Иван Иванович'
                && $data['paymentPurpose'] === 'Выплата по безопасной сделке';
        });
    }

    public function test_oauth_http_error_throws(): void
    {
        Http::fake([
            'epa-ift-sbp.vtb.ru/passport/oauth2/token' => Http::response(['error' => 'invalid_client'], 401),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('oauth2/token');

        app(VtbSbpPayoutClient::class)->dictionaryBanks();
    }
}
