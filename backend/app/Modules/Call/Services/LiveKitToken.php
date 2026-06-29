<?php

namespace Modules\Call\Services;

/**
 * Mint LiveKit access tokens (JWT HS256) without an external SDK.
 *
 * @see https://docs.livekit.io/home/get-started/authentication/
 */
class LiveKitToken
{
    /**
     * @param  array<string, mixed>  $grants  video grant overrides (room, roomJoin, canPublish…)
     */
    public static function create(string $identity, string $name, array $grants, int $ttl): string
    {
        $key = (string) config('livekit.api_key');
        $secret = (string) config('livekit.api_secret');
        $now = time();

        $video = array_merge([
            'roomJoin' => true,
            'canPublish' => true,
            'canSubscribe' => true,
            'canPublishData' => true,
        ], $grants);

        $payload = [
            'iss' => $key,
            'sub' => $identity,
            'name' => $name,
            'nbf' => $now,
            'iat' => $now,
            'exp' => $now + $ttl,
            'video' => $video,
        ];

        return self::encode($payload, $secret);
    }

    /** @param  array<string, mixed>  $payload */
    private static function encode(array $payload, string $secret): string
    {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $segments = [
            self::b64(json_encode($header, JSON_UNESCAPED_SLASHES)),
            self::b64(json_encode($payload, JSON_UNESCAPED_SLASHES)),
        ];
        $signing = implode('.', $segments);
        $sig = hash_hmac('sha256', $signing, $secret, true);
        $segments[] = self::b64($sig);

        return implode('.', $segments);
    }

    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
