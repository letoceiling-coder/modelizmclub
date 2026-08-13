<?php

namespace App\Services\Sms;

use App\Support\PhoneNormalizer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * iqsms JSON API — https://iqsms.ru/api/api_about/
 * POST {access_point}/messages/v2/send.json
 */
class IqSmsClient implements SmsSender
{
    /** @var list<string> Per-message statuses that mean the gateway accepted the SMS. */
    private const ACCEPTED_MESSAGE_STATUSES = ['accepted', 'queued'];

    public function send(string $phone, string $text): array
    {
        $driver = (string) config('sms.driver', 'iqsms');

        if ($driver === 'log') {
            Log::info('SMS (log driver)', ['phone' => $phone, 'text' => $text]);

            return ['status' => 'logged'];
        }

        $login = (string) config('sms.iqsms.login');
        $password = (string) config('sms.iqsms.password');
        $sender = (string) config('sms.iqsms.sender');
        $accessPoint = (string) config('sms.iqsms.access_point');

        if ($login === '' || $password === '') {
            throw new SmsDeliveryException('SMS credentials are not configured.');
        }

        if ($sender === '') {
            throw new SmsDeliveryException('SMS sender name is not configured.');
        }

        $gatewayPhone = PhoneNormalizer::toSmsGateway($phone);
        $url = $accessPoint.'/messages/v2/send.json';

        $payload = [
            'login' => $login,
            'password' => $password,
            'messages' => [[
                'clientId' => (string) str()->uuid(),
                'phone' => $gatewayPhone,
                'text' => $text,
                'sender' => $sender,
            ]],
        ];

        $response = Http::timeout(15)
            ->withHeaders(['Host' => (string) parse_url($accessPoint, PHP_URL_HOST)])
            ->asJson()
            ->post($url, $payload);

        if (! $response->successful()) {
            throw new SmsDeliveryException(
                'iqsms HTTP '.$response->status().': '.$response->body()
            );
        }

        $body = $response->json();
        if (! is_array($body)) {
            throw new SmsDeliveryException('iqsms: invalid JSON response');
        }

        if (($body['status'] ?? null) === 'error') {
            throw new SmsDeliveryException(
                'iqsms error: '.json_encode($body, JSON_UNESCAPED_UNICODE)
            );
        }

        $this->assertMessagesAccepted($body);

        Log::info('SMS sent via iqsms', [
            'phone' => $phone,
            'smsc_id' => $body['messages'][0]['smscId'] ?? null,
            'sender' => $sender,
        ]);

        return $body;
    }

    /** @param array<string, mixed> $body */
    private function assertMessagesAccepted(array $body): void
    {
        $messages = $body['messages'] ?? null;
        if (! is_array($messages) || $messages === []) {
            throw new SmsDeliveryException('iqsms: empty messages in response');
        }

        foreach ($messages as $message) {
            if (! is_array($message)) {
                continue;
            }

            $status = strtolower((string) ($message['status'] ?? ''));
            if (in_array($status, self::ACCEPTED_MESSAGE_STATUSES, true)) {
                continue;
            }

            $hint = match ($status) {
                'sender address invalid' => ' Подпись отправителя не зарегистрирована в IQSMS — проверьте IQSMS_SENDER.',
                default => '',
            };

            throw new SmsDeliveryException(
                'iqsms message rejected: '.$status.$hint
            );
        }
    }
}
