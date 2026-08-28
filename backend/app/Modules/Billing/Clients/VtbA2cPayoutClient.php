<?php

namespace Modules\Billing\Clients;

use RuntimeException;

/**
 * VTB account-to-card payouts (ОЭ). PAN is encrypted with GET v1/public-key
 * and never persisted — only last4 belongs in SafeDealPayout / requisites.
 *
 * @see https://test-pay.vtb.ru/api-developer-docs/#/api-transfer/account-to-card
 */
class VtbA2cPayoutClient
{
    public function __construct(
        private readonly VtbPayoutOAuthClient $oauth,
    ) {}

    /**
     * @return array{panPublicKey: string, cvvPublicKey?: string}
     */
    public function publicKey(): array
    {
        /** @var array{panPublicKey?: string, cvvPublicKey?: string} $data */
        $data = $this->oauth->getJson('transfers/v1/public-key');

        if (! isset($data['panPublicKey']) || $data['panPublicKey'] === '') {
            throw new RuntimeException('VTB transfers/v1/public-key missing panPublicKey');
        }

        return $data;
    }

    /**
     * RSA-encrypt PAN with panPublicKey (PEM or raw base64). Returns Base64.
     * Do not log $pan.
     */
    public function encryptPan(string $pan, string $panPublicKey): string
    {
        $digits = preg_replace('/\D/', '', $pan) ?? '';

        if ($digits === '') {
            throw new RuntimeException('VTB A2C encryptPan: empty PAN');
        }

        $pem = $this->toPem($panPublicKey);
        $encrypted = '';

        if (! openssl_public_encrypt($digits, $encrypted, $pem, OPENSSL_PKCS1_PADDING)) {
            throw new RuntimeException('VTB A2C encryptPan: openssl_public_encrypt failed');
        }

        return base64_encode($encrypted);
    }

    /**
     * @return array<string, mixed>
     */
    public function createAccountToCardTransfer(
        string $orderId,
        string $pan,
        int $amountKopecks,
        ?string $description = null,
        string $currency = 'RUB',
    ): array {
        $keys = $this->publicKey();
        $encryptedPan = $this->encryptPan($pan, $keys['panPublicKey']);

        return $this->oauth->postJson('transfers/v1/transfers/account-to-card', [
            'orderId' => $orderId,
            'description' => $description,
            'amount' => [
                'value' => VtbPayoutOAuthClient::rubFromKopecks($amountKopecks),
                'code' => $currency,
            ],
            'destination' => [
                'paymentData' => [
                    'type' => 'card',
                    'object' => [
                        'encryptedPan' => $encryptedPan,
                    ],
                ],
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function getTransfer(string $orderId): array
    {
        return $this->oauth->getJson('transfers/v1/transfers/'.rawurlencode($orderId));
    }

    private function toPem(string $key): string
    {
        $trimmed = trim($key);

        if (str_contains($trimmed, 'BEGIN PUBLIC KEY')) {
            return $trimmed;
        }

        $body = preg_replace('/\s+/', '', $trimmed) ?? '';

        return "-----BEGIN PUBLIC KEY-----\n".chunk_split($body, 64, "\n").'-----END PUBLIC KEY-----';
    }
}
