<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;

/**
 * iqSMS Mobile ID — подтверждение OTP-кода оператора (POST /v3/otp/verify-otp).
 */
class IqSmsOtpClient
{
    public function verify(string $otpToken, string $code): void
    {
        $accessPoint = rtrim((string) config('sms.iqsms.access_point', 'https://api.iqsms.ru'), '/');
        $url = $accessPoint.'/v3/otp/verify-otp';

        $response = Http::timeout(15)
            ->withHeaders(['Host' => (string) parse_url($accessPoint, PHP_URL_HOST)])
            ->asJson()
            ->post($url, [
                'otp_token' => $otpToken,
                'code' => $code,
            ]);

        if ($response->status() === 404) {
            throw new SmsDeliveryException(
                'Срок подтверждения истёк. Запросите код заново.',
                SmsFailureReason::GatewayRefused,
            );
        }

        if (! $response->successful()) {
            $body = $response->json();
            $description = is_array($body)
                ? (string) ($body['error_description'] ?? $body['error'] ?? $response->body())
                : $response->body();

            throw new SmsDeliveryException(
                'Неверный код из SMS: '.$description,
                SmsFailureReason::GatewayRefused,
            );
        }

        $body = $response->json();
        if (! is_array($body) || ($body['status'] ?? null) !== 'ok') {
            throw new SmsDeliveryException(
                'Не удалось подтвердить код у оператора.',
                SmsFailureReason::GatewayUnavailable,
            );
        }
    }
}
