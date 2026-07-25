<?php

namespace App\Support;

class FooterContacts
{
    public const SETTING_KEY = 'footer.contacts';

    /**
     * @param  array<string, mixed>|null  $raw
     * @return array{email?: string, phone?: string, hours?: string, social?: array<int, array{label: string, url: string}>}
     */
    public static function publicPayload(?array $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $payload = [];

        $email = self::cleanString($raw['email'] ?? null);
        if ($email !== null) {
            $payload['email'] = $email;
        }

        $phone = self::cleanString($raw['phone'] ?? null);
        if ($phone !== null) {
            $payload['phone'] = $phone;
        }

        $hours = self::cleanString($raw['hours'] ?? null);
        if ($hours !== null) {
            $payload['hours'] = $hours;
        }

        $social = self::cleanSocial($raw['social'] ?? null);
        if ($social !== []) {
            $payload['social'] = $social;
        }

        return $payload;
    }

    /**
     * @return array{email: string, phone: string, hours: string, social: array<int, array{label: string, url: string}>}
     */
    public static function emptyDraft(): array
    {
        return [
            'email' => '',
            'phone' => '',
            'hours' => '',
            'social' => [
                ['label' => 'VK', 'url' => ''],
                ['label' => 'MAX', 'url' => ''],
                ['label' => 'Telegram', 'url' => ''],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>|null  $raw
     * @return array{email: string, phone: string, hours: string, social: array<int, array{label: string, url: string}>}
     */
    public static function adminDraft(?array $raw): array
    {
        $draft = self::emptyDraft();

        if (! is_array($raw)) {
            return $draft;
        }

        $draft['email'] = self::cleanString($raw['email'] ?? null) ?? '';
        $draft['phone'] = self::cleanString($raw['phone'] ?? null) ?? '';
        $draft['hours'] = self::cleanString($raw['hours'] ?? null) ?? '';

        $existing = self::cleanSocial($raw['social'] ?? null);
        if ($existing === []) {
            return $draft;
        }

        $byLabel = collect($existing)->keyBy(fn (array $row) => mb_strtolower($row['label']));
        $draft['social'] = array_map(
            fn (array $row) => [
                'label' => $row['label'],
                'url' => $byLabel->get(mb_strtolower($row['label']))['url'] ?? '',
            ],
            $draft['social'],
        );

        foreach ($existing as $row) {
            $labelLower = mb_strtolower($row['label']);
            $known = collect($draft['social'])->contains(fn (array $s) => mb_strtolower($s['label']) === $labelLower);
            if (! $known) {
                $draft['social'][] = $row;
            }
        }

        return $draft;
    }

    /**
     * @param  array<string, mixed>  $draft
     * @return array<string, mixed>
     */
    public static function fromAdminDraft(array $draft): array
    {
        $value = [];

        $email = self::cleanString($draft['email'] ?? null);
        if ($email !== null) {
            $value['email'] = $email;
        }

        $phone = self::cleanString($draft['phone'] ?? null);
        if ($phone !== null) {
            $value['phone'] = $phone;
        }

        $hours = self::cleanString($draft['hours'] ?? null);
        if ($hours !== null) {
            $value['hours'] = $hours;
        }

        $social = self::cleanSocial($draft['social'] ?? null);
        if ($social !== []) {
            $value['social'] = $social;
        }

        return $value;
    }

    private static function cleanString(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    /**
     * @return array<int, array{label: string, url: string}>
     */
    private static function cleanSocial(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $rows = [];
        foreach ($value as $row) {
            if (! is_array($row)) {
                continue;
            }
            $label = self::cleanString($row['label'] ?? null);
            $url = self::cleanString($row['url'] ?? null);
            if ($label === null || $url === null) {
                continue;
            }
            if (! filter_var($url, FILTER_VALIDATE_URL)) {
                continue;
            }
            $rows[] = ['label' => $label, 'url' => $url];
        }

        return $rows;
    }
}
