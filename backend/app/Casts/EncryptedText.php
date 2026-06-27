<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/**
 * Transparent at-rest encryption for a text column.
 *
 * Writing: the value is encrypted with the application key only when
 * `chat.encrypt_messages` is enabled, so the feature can be switched on
 * without a migration and without rewriting historical rows.
 *
 * Reading: an encrypted payload is decrypted; any value that is not a valid
 * Laravel cipher payload (i.e. plaintext written before encryption was
 * enabled) is returned verbatim. This makes a mixed table of legacy plaintext
 * and new ciphertext fully readable.
 *
 * @implements CastsAttributes<string|null, string|null>
 */
class EncryptedText implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return $value;
        }

        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            return $value;
        }
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '' || ! config('chat.encrypt_messages', false)) {
            return $value;
        }

        return Crypt::encryptString((string) $value);
    }
}
