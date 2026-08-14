<?php

namespace App\Support;

use App\Models\Media;

class SiteBranding
{
    public const SETTING_KEY = 'branding.logo';

    /**
     * @param  array<string, mixed>|null  $raw
     * @return array{logo_url?: string, footer_logo_url?: string, header_size: int, footer_size: int}
     */
    public static function publicPayload(?array $raw): array
    {
        $headerUuid = is_array($raw) ? self::cleanUuid($raw['header_media_uuid'] ?? null) : null;
        $footerUuid = is_array($raw) ? self::cleanUuid($raw['footer_media_uuid'] ?? null) : null;
        $headerSize = is_array($raw) ? self::cleanSize($raw['header_size'] ?? null, 48) : 48;
        $footerSize = is_array($raw) ? self::cleanSize($raw['footer_size'] ?? null, 36) : 36;

        $payload = [
            'header_size' => $headerSize,
            'footer_size' => $footerSize,
        ];

        $headerUrl = self::mediaUrl($headerUuid);
        if ($headerUrl !== null) {
            $payload['logo_url'] = $headerUrl;
        }

        $footerUrl = self::mediaUrl($footerUuid);
        if ($footerUrl !== null) {
            $payload['footer_logo_url'] = $footerUrl;
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>|null  $raw
     * @return array{header_media_uuid: ?string, footer_media_uuid: ?string, header_size: int, footer_size: int}
     */
    public static function adminDraft(?array $raw): array
    {
        if (! is_array($raw)) {
            return [
                'header_media_uuid' => null,
                'footer_media_uuid' => null,
                'header_size' => 48,
                'footer_size' => 36,
            ];
        }

        return [
            'header_media_uuid' => self::cleanUuid($raw['header_media_uuid'] ?? null),
            'footer_media_uuid' => self::cleanUuid($raw['footer_media_uuid'] ?? null),
            'header_size' => self::cleanSize($raw['header_size'] ?? null, 48),
            'footer_size' => self::cleanSize($raw['footer_size'] ?? null, 36),
        ];
    }

    /**
     * @param  array<string, mixed>  $draft
     * @return array<string, mixed>
     */
    public static function fromAdminDraft(array $draft): array
    {
        return [
            'header_media_uuid' => self::cleanUuid($draft['header_media_uuid'] ?? null),
            'footer_media_uuid' => self::cleanUuid($draft['footer_media_uuid'] ?? null),
            'header_size' => self::cleanSize($draft['header_size'] ?? null, 48),
            'footer_size' => self::cleanSize($draft['footer_size'] ?? null, 36),
        ];
    }

    private static function cleanUuid(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return preg_match('/^[0-9a-f-]{36}$/i', $trimmed) ? strtolower($trimmed) : null;
    }

    private static function cleanSize(mixed $value, int $fallback): int
    {
        if (! is_numeric($value)) {
            return $fallback;
        }

        return max(24, min(96, (int) $value));
    }

    private static function mediaUrl(?string $uuid): ?string
    {
        if ($uuid === null) {
            return null;
        }

        $media = Media::query()->where('uuid', $uuid)->first();

        return $media?->url;
    }
}
