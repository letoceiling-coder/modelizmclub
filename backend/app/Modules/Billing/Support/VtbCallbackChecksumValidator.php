<?php

namespace Modules\Billing\Support;

/**
 * Validates VTB/RBS callback checksum (symmetric HMAC-SHA256).
 *
 * @see https://securecardpayment.ru/wiki/doku.php/integration:api:callback:start
 */
class VtbCallbackChecksumValidator
{
    public function __construct(
        private readonly string $secret,
    ) {}

    /**
     * @param  array<string, mixed>  $params
     */
    public function valid(array $params): bool
    {
        $checksum = (string) ($params['checksum'] ?? '');

        if ($checksum === '' || $this->secret === '') {
            return false;
        }

        $expected = $this->compute($params);

        return hash_equals(strtoupper($checksum), strtoupper($expected));
    }

    /**
     * @param  array<string, mixed>  $params
     */
    public function compute(array $params): string
    {
        $filtered = $params;
        unset($filtered['checksum'], $filtered['sign_alias']);

        ksort($filtered, SORT_STRING);

        $parts = [];
        foreach ($filtered as $name => $value) {
            if (is_array($value)) {
                continue;
            }

            $parts[] = $name.';'.(string) $value.';';
        }

        $payload = implode('', $parts);

        return strtoupper(hash_hmac('sha256', $payload, $this->secret));
    }
}
