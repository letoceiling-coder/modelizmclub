<?php

namespace Tests\Unit;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Modules\Billing\Clients\VtbA2cPayoutClient;
use Modules\Billing\Clients\VtbPayoutOAuthClient;
use Tests\TestCase;

class VtbA2cPayoutClientTest extends TestCase
{
    private mixed $privateKey;

    private string $publicPem = '';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'billing.vtb_payout.enabled' => true,
            'billing.vtb_payout.oauth_url' => 'https://epa-ift-sbp.vtb.ru/passport/oauth2/token',
            'billing.vtb_payout.api_url' => 'https://test3.api.vtb.ru:8443/openapi/smb/efcp',
            'billing.vtb_payout.client_id' => 'ext.cmm.test-id',
            'billing.vtb_payout.client_secret' => 'secret',
            'billing.vtb_payout.merchant_authorization' => 'merchant-uuid',
            'billing.vtb_payout.source_system_id' => 'modelizmclub',
        ]);

        Cache::forget(VtbPayoutOAuthClient::CACHE_KEY);

        $this->privateKey = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $this->assertNotFalse($this->privateKey, 'openssl_pkey_new failed');
        $details = openssl_pkey_get_details($this->privateKey);
        $this->assertIsArray($details);
        $this->publicPem = (string) $details['key'];
    }

    public function test_encrypt_pan_round_trips_and_wraps_headerless_key(): void
    {
        $client = app(VtbA2cPayoutClient::class);
        $encrypted = $client->encryptPan('4111 1111 1111 1111', $this->publicPem);

        $plain = '';
        $ok = openssl_private_decrypt(base64_decode($encrypted), $plain, $this->privateKey, OPENSSL_PKCS1_PADDING);
        $this->assertTrue($ok);
        $this->assertSame('4111111111111111', $plain);

        $body = preg_replace('/-----.*?-----|\s+/', '', $this->publicPem) ?? '';
        $encryptedRaw = $client->encryptPan('4111111111111111', $body);
        $plainRaw = '';
        openssl_private_decrypt(base64_decode($encryptedRaw), $plainRaw, $this->privateKey, OPENSSL_PKCS1_PADDING);
        $this->assertSame('4111111111111111', $plainRaw);
    }

    public function test_create_account_to_card_posts_encrypted_pan_not_raw(): void
    {
        $publicPem = $this->publicPem;
        $privateKey = $this->privateKey;
        $postedPan = null;

        Http::fake(function ($request) use ($publicPem, &$postedPan) {
            if (str_contains($request->url(), 'oauth2/token')) {
                return Http::response([
                    'access_token' => 'tok-1',
                    'expires_in' => 179,
                    'token_type' => 'Bearer',
                ]);
            }

            if (str_contains($request->url(), 'transfers/v1/public-key')) {
                return Http::response(['panPublicKey' => $publicPem, 'cvvPublicKey' => 'ignore']);
            }

            if (str_contains($request->url(), 'transfers/account-to-card')) {
                $postedPan = $request['destination']['paymentData']['object']['encryptedPan'] ?? null;

                return Http::response([
                    'type' => 'TRANSFER',
                    'object' => [
                        'orderId' => 'TRANSFER000001',
                        'orderCode' => '7ed9ac8a-7a9b-4d07-945f-8c5b72bc95b6',
                        'status' => ['value' => 'CREATED', 'description' => 'CREATED'],
                    ],
                ]);
            }

            return Http::response(['error' => 'unexpected '.$request->url()], 500);
        });

        $result = app(VtbA2cPayoutClient::class)->createAccountToCardTransfer(
            'TRANSFER000001',
            '4111111111111111',
            37400,
            'Выплата продавцу',
        );

        $this->assertSame('TRANSFER', $result['type']);
        $this->assertSame('CREATED', $result['object']['status']['value']);
        $this->assertIsString($postedPan);
        $this->assertNotSame('4111111111111111', $postedPan);

        $plain = '';
        openssl_private_decrypt(base64_decode((string) $postedPan), $plain, $privateKey, OPENSSL_PKCS1_PADDING);
        $this->assertSame('4111111111111111', $plain);

        Http::assertSent(function ($request): bool {
            if (! str_contains($request->url(), 'account-to-card')) {
                return false;
            }

            $data = $request->data();

            return $data['orderId'] === 'TRANSFER000001'
                && $data['amount']['value'] === 374.0
                && $data['amount']['code'] === 'RUB'
                && $data['destination']['paymentData']['type'] === 'card'
                && ! str_contains(json_encode($data), '4111111111111111');
        });
    }

    public function test_get_transfer_by_order_id(): void
    {
        Http::fake([
            'epa-ift-sbp.vtb.ru/passport/oauth2/token' => Http::response([
                'access_token' => 'tok-1',
                'expires_in' => 179,
                'token_type' => 'Bearer',
            ]),
            'test3.api.vtb.ru:8443/openapi/smb/efcp/transfers/v1/transfers/TRANSFER000001' => Http::response([
                'type' => 'TRANSFER',
                'object' => [
                    'orderId' => 'TRANSFER000001',
                    'status' => ['value' => 'PAID'],
                ],
            ]),
        ]);

        $result = app(VtbA2cPayoutClient::class)->getTransfer('TRANSFER000001');

        $this->assertSame('PAID', $result['object']['status']['value']);
    }
}
