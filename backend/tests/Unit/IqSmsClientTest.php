<?php

namespace Tests\Unit;

use App\Services\Sms\IqSmsClient;
use App\Services\Sms\SmsDeliveryException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class IqSmsClientTest extends TestCase
{
    public function test_rejects_sender_address_invalid_even_when_top_level_ok(): void
    {
        config([
            'sms.driver' => 'iqsms',
            'sms.iqsms.login' => 'user',
            'sms.iqsms.password' => 'pass',
            'sms.iqsms.sender' => 'BadSender',
            'sms.iqsms.access_point' => 'https://api.iqsms.ru',
            'sms.iqsms.verify_delivery_after_seconds' => 0,
        ]);

        Http::fake([
            'api.iqsms.ru/messages/v2/send.json' => Http::response([
                'status' => 'ok',
                'messages' => [
                    ['clientId' => '1', 'status' => 'sender address invalid'],
                ],
            ]),
        ]);

        $this->expectException(SmsDeliveryException::class);
        $this->expectExceptionMessage('sender address invalid');

        app(IqSmsClient::class)->send('+79897625658', 'test');
    }

    public function test_accepts_message_with_accepted_status(): void
    {
        config([
            'sms.driver' => 'iqsms',
            'sms.iqsms.login' => 'user',
            'sms.iqsms.password' => 'pass',
            'sms.iqsms.sender' => 'Postmen',
            'sms.iqsms.access_point' => 'https://api.iqsms.ru',
            'sms.iqsms.verify_delivery_after_seconds' => 0,
        ]);

        Http::fake([
            'api.iqsms.ru/messages/v2/send.json' => Http::response([
                'status' => 'ok',
                'messages' => [
                    ['clientId' => '1', 'smscId' => 123, 'status' => 'accepted'],
                ],
            ]),
        ]);

        $result = app(IqSmsClient::class)->send('+79897625658', 'test');

        $this->assertSame('ok', $result['status']);
    }

    public function test_omits_sender_from_payload_when_not_configured(): void
    {
        config([
            'sms.driver' => 'iqsms',
            'sms.iqsms.login' => 'user',
            'sms.iqsms.password' => 'pass',
            'sms.iqsms.sender' => '',
            'sms.iqsms.access_point' => 'https://api.iqsms.ru',
            'sms.iqsms.verify_delivery_after_seconds' => 0,
        ]);

        Http::fake([
            'api.iqsms.ru/messages/v2/send.json' => Http::response([
                'status' => 'ok',
                'messages' => [
                    ['clientId' => '1', 'smscId' => 123, 'status' => 'accepted'],
                ],
            ]),
        ]);

        app(IqSmsClient::class)->send('+79897625658', 'test');

        Http::assertSent(function ($request): bool {
            $messages = $request->data()['messages'] ?? [];

            return ($messages[0]['phone'] ?? null) === '79897625658'
                && ! array_key_exists('sender', $messages[0]);
        });
    }

    public function test_rejects_when_operator_reports_delivery_error(): void
    {
        config([
            'sms.driver' => 'iqsms',
            'sms.iqsms.login' => 'user',
            'sms.iqsms.password' => 'pass',
            'sms.iqsms.sender' => '',
            'sms.iqsms.access_point' => 'https://api.iqsms.ru',
            'sms.iqsms.verify_delivery_after_seconds' => 1,
        ]);

        Http::fake([
            'api.iqsms.ru/messages/v2/send.json' => Http::response([
                'status' => 'ok',
                'messages' => [
                    ['clientId' => '1', 'smscId' => 999, 'status' => 'accepted'],
                ],
            ]),
            'api.iqsms.ru/messages/v2/status.json' => Http::response([
                'status' => 'ok',
                'messages' => [
                    ['smscId' => '999', 'status' => 'delivery error'],
                ],
            ]),
        ]);

        $this->expectException(SmsDeliveryException::class);
        $this->expectExceptionMessage('delivery failed');

        app(IqSmsClient::class)->send('+79897625658', 'Modelizm: код подтверждения 123456.');
    }
}
