<?php

namespace Modules\Account\Services;

use App\Models\User;
use App\Models\UserTwoFactor;
use Illuminate\Validation\ValidationException;

class TwoFactorService
{
    private const PERIOD = 30;

    /** @return array{secret: string, otpauth_url: string} */
    public function setup(User $user): array
    {
        $secret = $this->generateSecret();

        UserTwoFactor::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'secret' => $secret,
                'enabled' => false,
                'confirmed_at' => null,
            ],
        );

        $label = rawurlencode($user->email ?? 'user-'.$user->id);
        $issuer = rawurlencode(config('app.name', 'ModelizmClub'));

        return [
            'secret' => $secret,
            'otpauth_url' => "otpauth://totp/{$issuer}:{$label}?secret={$secret}&issuer={$issuer}&period=".self::PERIOD,
        ];
    }

    public function verify(User $user, string $code): void
    {
        $row = UserTwoFactor::query()->where('user_id', $user->id)->first();

        if (! $row || ! $this->checkCode($row->secret, $code)) {
            throw ValidationException::withMessages([
                'code' => ['Неверный код подтверждения.'],
            ]);
        }

        $row->update([
            'enabled' => true,
            'confirmed_at' => now(),
        ]);
    }

    public function disable(User $user, string $code): void
    {
        $row = UserTwoFactor::query()->where('user_id', $user->id)->first();

        if (! $row?->enabled) {
            return;
        }

        if (! $this->checkCode($row->secret, $code)) {
            throw ValidationException::withMessages([
                'code' => ['Неверный код подтверждения.'],
            ]);
        }

        $row->delete();
    }

    private function generateSecret(): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';
        for ($i = 0; $i < 16; $i++) {
            $secret .= $alphabet[random_int(0, 31)];
        }

        return $secret;
    }

    private function checkCode(string $secret, string $code): bool
    {
        $code = preg_replace('/\D/', '', $code) ?? '';
        if (strlen($code) !== 6) {
            return false;
        }

        $time = (int) floor(time() / self::PERIOD);
        foreach ([-1, 0, 1] as $offset) {
            if (hash_equals($this->totp($secret, $time + $offset), $code)) {
                return true;
            }
        }

        return false;
    }

    private function totp(string $secret, int $counter): string
    {
        $key = $this->base32Decode($secret);
        $bin = pack('N*', 0, $counter);
        $hash = hash_hmac('sha1', $bin, $key, true);
        $offset = ord(substr($hash, -1)) & 0x0F;
        $value = (
            ((ord($hash[$offset]) & 0x7F) << 24)
            | ((ord($hash[$offset + 1]) & 0xFF) << 16)
            | ((ord($hash[$offset + 2]) & 0xFF) << 8)
            | (ord($hash[$offset + 3]) & 0xFF)
        );

        return str_pad((string) ($value % 1_000_000), 6, '0', STR_PAD_LEFT);
    }

    private function base32Decode(string $secret): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = strtoupper($secret);
        $buffer = 0;
        $bits = 0;
        $output = '';

        for ($i = 0, $len = strlen($secret); $i < $len; $i++) {
            $pos = strpos($alphabet, $secret[$i]);
            if ($pos === false) {
                continue;
            }
            $buffer = ($buffer << 5) | $pos;
            $bits += 5;
            if ($bits >= 8) {
                $bits -= 8;
                $output .= chr(($buffer >> $bits) & 0xFF);
            }
        }

        return $output;
    }
}
