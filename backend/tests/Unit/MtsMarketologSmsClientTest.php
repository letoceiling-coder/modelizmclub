<?php

namespace Tests\Unit;

use App\Services\Sms\MtsMarketologSmsClient;
use App\Services\Sms\SmsDeliveryException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MtsMarketologSmsClientTest extends TestCase
{
    public function test_basic_auth_send_success(): void
    {
        config([
            'sms.driver' => 'mts',
            'sms.mts.auth' => 'basic',
            'sms.mts.login' => 'api_login',
            'sms.mts.password' => 'api_pass',
            'sms.mts.sender' => 'Modelizm',
            'sms.mts.omnichannel_url' => 'https://omnichannel.mts.ru/http-api/v1',
        ]);

        Http::fake([
            'omnichannel.mts.ru/http-api/v1/messages' => Http::response([
                'messages' => [['internal_id' => 'abc-123']],
            ]),
        ]);

        $result = app(MtsMarketologSmsClient::class)->send('+79897625658', 'Код 123456');

        $this->assertSame('abc-123', $result['messages'][0]['internal_id']);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://omnichannel.mts.ru/http-api/v1/messages'
                && $request['options']['from']['sms_address'] === 'Modelizm'
                && $request['messages'][0]['to'][0]['msisdn'] === '79897625658';
        });
    }

    public function test_token_auth_rejects_non_ok_submit(): void
    {
        config([
            'sms.driver' => 'mts',
            'sms.mts.auth' => 'token',
            'sms.mts.token' => 'secret-token',
            'sms.mts.sender' => 'Modelizm',
            'sms.mts.token_api_url' => 'https://api.mts.ru/client-omni-adapter_production/1.0.2/mcom/messageManagement/messages',
        ]);

        Http::fake([
            'api.mts.ru/*' => Http::response([
                'data' => [
                    'submitResults' => [
                        ['msid' => '79897625658', 'code' => 'ERROR', 'messageID' => 1],
                    ],
                ],
            ]),
        ]);

        $this->expectException(SmsDeliveryException::class);
        $this->expectExceptionMessage('rejected');

        app(MtsMarketologSmsClient::class)->send('+79897625658', 'test');
    }
}
