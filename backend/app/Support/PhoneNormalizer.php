<?php

namespace App\Support;

class PhoneNormalizer
{
    /** Normalize to E.164-ish +7XXXXXXXXXX for RU numbers. */
    public static function normalize(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '') {
            return null;
        }

        if (str_starts_with($digits, '8') && strlen($digits) === 11) {
            $digits = '7'.substr($digits, 1);
        } elseif (strlen($digits) === 10) {
            $digits = '7'.$digits;
        }

        if (! preg_match('/^7\d{10}$/', $digits)) {
            return null;
        }

        return '+'.$digits;
    }

    /** iqsms expects digits only, e.g. 79991234567 */
    public static function toSmsGateway(string $normalizedPhone): string
    {
        return ltrim($normalizedPhone, '+');
    }

}
