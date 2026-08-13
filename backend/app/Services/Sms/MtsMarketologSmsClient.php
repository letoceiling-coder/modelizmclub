<?php

namespace App\Services\Sms;

use App\Support\PhoneNormalizer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * MTS Marketolog REST API — «Рассылки по своей базе PRO».
 *
 * @see https://support.mts.ru/mts_marketolog/rassilki-po-svoei-baze-pro-i-api-k-nim/dokumentatsiya-rest-api
 */
class MtsMarketologSmsClient implements SmsSender
{
    public function send(string $phone, string $text): array
    {
        $driver = (string) config('sms.driver', 'iqsms');
        if ($driver === 'log') {
            Log::info('SMS (log driver)', ['phone' => $phone, 'text' => $text]);

            return ['status' => 'logged'];
        }

        $auth = (string) config('sms.mts.auth', 'basic');
        if ($auth === 'token') {
            return $this->sendWithToken($phone, $text);
        }

        return $this->sendWithBasicAuth($phone, $text);
    }

    /** @return array<string, mixed> */
    private function sendWithBasicAuth(string $phone, string $text): array
    {
        $login = (string) config('sms.mts.login');
        $password = (string) config('sms.mts.password');
        $sender = (string) config('sms.mts.sender');
        $url = rtrim((string) config('sms.mts.omnichannel_url'), '/').'/messages';

        if ($login === '' || $password === '') {
            throw new SmsDeliveryException('MTS SMS credentials are not configured (MTS_LOGIN / MTS_PASSWORD).');
        }

        if ($sender === '') {
            throw new SmsDeliveryException('MTS sender name is not configured (MTS_SENDER).');
        }

        $msisdn = PhoneNormalizer::toSmsGateway($phone);
        $messageId = (string) str()->uuid();

        $payload = [
            'messages' => [[
                'content' => ['short_text' => $text],
                'to' => [[
                    'msisdn' => $msisdn,
                    'message_id' => $messageId,
                ]],
            ]],
            'options' => [
                'from' => ['sms_address' => $sender],
            ],
        ];

        $response = Http::timeout(20)
            ->withBasicAuth($login, $password)
            ->acceptJson()
            ->asJson()
            ->post($url, $payload);

        if (! $response->successful()) {
            throw new SmsDeliveryException(
                'MTS omnichannel HTTP '.$response->status().': '.$response->body()
            );
        }

        $body = $response->json();
        if (! is_array($body)) {
            throw new SmsDeliveryException('MTS omnichannel: invalid JSON response');
        }

        if (isset($body['code']) && (int) $body['code'] >= 400) {
            throw new SmsDeliveryException(
                'MTS omnichannel error: '.json_encode($body, JSON_UNESCAPED_UNICODE)
            );
        }

        $internalId = $body['messages'][0]['internal_id'] ?? null;

        Log::info('SMS sent via MTS Marketolog (basic auth)', [
            'phone' => $phone,
            'message_id' => $messageId,
            'internal_id' => $internalId,
            'sender' => $sender,
        ]);

        return $body;
    }

    /** @return array<string, mixed> */
    private function sendWithToken(string $phone, string $text): array
    {
        $token = (string) config('sms.mts.token');
        $sender = (string) config('sms.mts.sender');
        $url = rtrim((string) config('sms.mts.token_api_url'), '/');

        if ($token === '') {
            throw new SmsDeliveryException('MTS API token is not configured (MTS_TOKEN).');
        }

        if ($sender === '') {
            throw new SmsDeliveryException('MTS sender name is not configured (MTS_SENDER).');
        }

        $msisdn = PhoneNormalizer::toSmsGateway($phone);

        $payload = [
            'submits' => [[
                'msid' => $msisdn,
                'message' => $text,
            ]],
            'naming' => $sender,
        ];

        $response = Http::timeout(20)
            ->withToken($token)
            ->acceptJson()
            ->asJson()
            ->post($url, $payload);

        if (! $response->successful()) {
            throw new SmsDeliveryException(
                'MTS token API HTTP '.$response->status().': '.$response->body()
            );
        }

        $body = $response->json();
        if (! is_array($body)) {
            throw new SmsDeliveryException('MTS token API: invalid JSON response');
        }

        $results = $body['data']['submitResults'] ?? null;
        if (is_array($results)) {
            foreach ($results as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $code = strtoupper((string) ($row['code'] ?? ''));
                if ($code !== '' && $code !== 'OK') {
                    throw new SmsDeliveryException(
                        'MTS token API rejected message: '.json_encode($row, JSON_UNESCAPED_UNICODE)
                    );
                }
            }
        }

        Log::info('SMS sent via MTS Marketolog (token)', [
            'phone' => $phone,
            'sender' => $sender,
        ]);

        return $body;
    }
}
