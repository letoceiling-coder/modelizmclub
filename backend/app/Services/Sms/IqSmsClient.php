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

    /**
     * Статусы, в которых шлюз сам называет номер неверным или недоступным.
     *
     * Только о них человеку говорится «проверьте номер» (решение Ж5). Всё
     * остальное — наша сторона, в том числе неизвестный статус.
     *
     * @var list<string>
     */
    private const BAD_NUMBER_MESSAGE_STATUSES = [
        'invalid mobile phone',
        'invalid phone',
        'wrong phone',
        'wrong destination address',
    ];

    public function isConfigured(): bool
    {
        return filled(config('sms.iqsms.login')) && filled(config('sms.iqsms.password'));
    }

    public function send(string $phone, string $text, array $options = []): array
    {
        $login = (string) config('sms.iqsms.login');
        $password = (string) config('sms.iqsms.password');
        $sender = (string) config('sms.iqsms.sender');
        $accessPoint = (string) config('sms.iqsms.access_point');

        if ($login === '' || $password === '') {
            throw new SmsDeliveryException(
                'SMS credentials are not configured.',
                SmsFailureReason::NotConfigured,
            );
        }

        $gatewayPhone = PhoneNormalizer::toSmsGateway($phone);
        $url = $accessPoint.'/messages/v2/send.json';

        /*
         * Подпись отправителя необязательна (REST API СМС Дисконт).
         *
         * Если `sender` не передать, провайдер шлёт от общей подписи по
         * умолчанию — так в их PHP-примере и в JsonSmsApi (пустые поля
         * выкидываются из пакета). Именованные SMS DUCKOHT / MediaGramma
         * на части номеров дают delivery error у оператора.
         *
         * Пустой `IQSMS_SENDER` в `.env` — осознанный выбор «без своей
         * подписи», а не ошибка конфигурации.
         */
        $clientId = (string) ($options['client_id'] ?? str()->uuid());
        $message = [
            'clientId' => $clientId,
            'phone' => $gatewayPhone,
            'text' => $text,
        ];
        if ($sender !== '') {
            $message['sender'] = $sender;
        }
        $callback = (string) ($options['status_callback_url'] ?? '');
        if ($callback !== '') {
            $message['status_callback_url'] = $callback;
        }

        $payload = [
            'login' => $login,
            'password' => $password,
            'messages' => [$message],
        ];

        $response = Http::timeout(15)
            ->withHeaders(['Host' => (string) parse_url($accessPoint, PHP_URL_HOST)])
            ->asJson()
            ->post($url, $payload);

        if (! $response->successful()) {
            throw new SmsDeliveryException(
                'iqsms HTTP '.$response->status().': '.$response->body(),
                SmsFailureReason::GatewayUnavailable,
            );
        }

        $body = $response->json();
        if (! is_array($body)) {
            throw new SmsDeliveryException(
                'iqsms: invalid JSON response',
                SmsFailureReason::GatewayUnavailable,
            );
        }

        if (($body['status'] ?? null) === 'error') {
            /* Отказ уровня аккаунта: баланс, запрос, доступы. О номере здесь
               ничего не сказано, поэтому номер и не обвиняем. */
            throw new SmsDeliveryException(
                'iqsms error: '.json_encode($body, JSON_UNESCAPED_UNICODE),
                SmsFailureReason::GatewayRefused,
            );
        }

        $this->assertMessagesAccepted($body);

        $smscId = $body['messages'][0]['smscId'] ?? null;
        $submitStatus = strtolower((string) ($body['messages'][0]['status'] ?? ''));

        Log::info('SMS sent via iqsms', [
            'phone' => $phone,
            'smsc_id' => $smscId,
            'submit_status' => $submitStatus,
            'sender' => $sender !== '' ? $sender : '(default)',
            'text_len' => strlen($text),
            'text' => $text,
        ]);

        $wait = (int) config('sms.iqsms.verify_delivery_after_seconds', 3);
        if ($wait > 0 && $smscId !== null && $smscId !== '') {
            sleep($wait);
            $deliveryStatus = $this->fetchDeliveryStatus((string) $smscId);
            Log::info('iqsms delivery status', [
                'phone' => $phone,
                'smsc_id' => $smscId,
                'status' => $deliveryStatus,
            ]);
            if (in_array($deliveryStatus, ['delivery error', 'failed', 'rejected'], true)) {
                throw new SmsDeliveryException(
                    'iqsms delivery failed: '.$deliveryStatus.' (smscId='.$smscId.')',
                    SmsFailureReason::GatewayRefused,
                );
            }
        }

        return $body;
    }

    public function fetchDeliveryStatus(string $smscId): string
    {
        $login = (string) config('sms.iqsms.login');
        $password = (string) config('sms.iqsms.password');
        $accessPoint = (string) config('sms.iqsms.access_point');
        $url = $accessPoint.'/messages/v2/status.json';

        $response = Http::timeout(15)
            ->withHeaders(['Host' => (string) parse_url($accessPoint, PHP_URL_HOST)])
            ->asJson()
            ->post($url, [
                'login' => $login,
                'password' => $password,
                'messages' => [['smscId' => $smscId]],
            ]);

        if (! $response->successful()) {
            return 'status_http_'.$response->status();
        }

        $body = $response->json();
        if (! is_array($body)) {
            return 'status_invalid_json';
        }

        $messages = $body['messages'] ?? [];
        if (! is_array($messages) || $messages === []) {
            return 'status_empty';
        }

        return strtolower((string) ($messages[0]['status'] ?? 'unknown'));
    }

    /** @param array<string, mixed> $body */
    private function assertMessagesAccepted(array $body): void
    {
        $messages = $body['messages'] ?? null;
        if (! is_array($messages) || $messages === []) {
            throw new SmsDeliveryException(
                'iqsms: empty messages in response',
                SmsFailureReason::GatewayUnavailable,
            );
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

            /*
             * Номер обвиняем только там, где шлюз назвал его сам.
             *
             * Решение Ж5: «Сообщение об ошибке не обвиняет пользователя, если
             * причина на стороне сервиса». Незнакомый статус — это «мы не
             * знаем», а не «номер плохой»: чтобы сказать человеку «проверьте
             * номер», нужно, чтобы шлюз это сказал.
             *
             * Статусы берутся из iqsms.ru/api/api_about. Новый статус про
             * номер добавляется сюда строкой; пока его тут нет, человек
             * получит честное «не получается отправить», а причина со словами
             * шлюза ляжет в журнал и в админку.
             */
            $причина = in_array($status, self::BAD_NUMBER_MESSAGE_STATUSES, true)
                ? SmsFailureReason::BadNumber
                : SmsFailureReason::GatewayRefused;

            throw new SmsDeliveryException(
                'iqsms message rejected: '.$status.$hint,
                $причина,
            );
        }
    }
}
