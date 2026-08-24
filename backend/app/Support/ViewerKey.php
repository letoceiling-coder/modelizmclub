<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** Stable identity for unique view counting (auth user or guest session). */
final class ViewerKey
{
    public const COOKIE = 'mc_vid';

    public static function for(?User $user, Request $request): string
    {
        if ($user) {
            return 'u:'.$user->id;
        }

        $raw = $request->header('X-Guest-Viewer')
            ?: $request->cookie(self::COOKIE)
            ?: $request->session()->getId();

        $raw = is_string($raw) ? trim($raw) : '';
        if ($raw !== '' && preg_match('/^[A-Za-z0-9._:-]{8,80}$/', $raw)) {
            return 'g:'.substr($raw, 0, 80);
        }

        $ip = (string) $request->ip();

        return $ip !== '' ? 'ip:'.hash('sha256', $ip) : 'g:'.Str::uuid()->toString();
    }

    public static function ensureCookie(Request $request): ?string
    {
        $existing = $request->cookie(self::COOKIE);
        if (is_string($existing) && $existing !== '') {
            return $existing;
        }

        return (string) Str::uuid();
    }
}
