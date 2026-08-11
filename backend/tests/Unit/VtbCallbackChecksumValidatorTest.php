<?php

namespace Tests\Unit;

use Modules\Billing\Support\VtbCallbackChecksumValidator;
use PHPUnit\Framework\TestCase;

class VtbCallbackChecksumValidatorTest extends TestCase
{
    public function test_validates_hmac_sha256_checksum(): void
    {
        $secret = '20546026a3675994185a132875efe41a';
        $validator = new VtbCallbackChecksumValidator($secret);

        $params = [
            'amount' => '123456',
            'mdOrder' => '3ff6962a-7dcc-4283-ab50-a6d7dd3386fe',
            'operation' => 'deposited',
            'orderNumber' => '10747',
            'status' => '1',
        ];

        $params['checksum'] = $validator->compute($params);

        $this->assertTrue($validator->valid($params));
    }

    public function test_rejects_tampered_checksum(): void
    {
        $validator = new VtbCallbackChecksumValidator('secret-key');

        $params = [
            'mdOrder' => 'order-1',
            'orderNumber' => '42',
            'operation' => 'deposited',
            'status' => '1',
            'checksum' => 'DEADBEEF',
        ];

        $this->assertFalse($validator->valid($params));
    }
}
