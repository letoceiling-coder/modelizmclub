<?php

namespace App\Support;

final class LucideIconName
{
    /** Normalize stored icon keys to Lucide PascalCase component names. */
    public static function normalize(?string $name): string
    {
        $raw = trim((string) $name);
        if ($raw === '') {
            return 'Box';
        }

        if (str_contains($raw, '-')) {
            $parts = explode('-', $raw);

            return implode('', array_map(static fn (string $p) => ucfirst(strtolower($p)), $parts));
        }

        return ucfirst(strtolower($raw));
    }
}
