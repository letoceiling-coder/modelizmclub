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
}
