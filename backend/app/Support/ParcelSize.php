<?php

namespace App\Support;

use App\Models\Listing;

final class ParcelSize
{
    /** @var array<string, array{length: int, width: int, height: int, weight_kg: float, label: string}> */
    public const PRESETS = [
        's' => ['length' => 20, 'width' => 15, 'height' => 10, 'weight_kg' => 0.5, 'label' => 'S'],
        'm' => ['length' => 30, 'width' => 20, 'height' => 15, 'weight_kg' => 2.0, 'label' => 'M'],
        'l' => ['length' => 40, 'width' => 30, 'height' => 25, 'weight_kg' => 5.0, 'label' => 'L'],
    ];

    public static function offersCdek(?array $methods): bool
    {
        foreach ($methods ?? [] as $method) {
            $value = mb_strtolower(trim((string) $method));
            if ($value === 'cdek' || str_contains($value, 'сдэк') || str_contains($value, 'cdek')) {
                return true;
            }
        }

        return false;
    }

    public static function offersPickup(?array $methods): bool
    {
        foreach ($methods ?? [] as $method) {
            $value = mb_strtolower(trim((string) $method));
            if (str_contains($value, 'самовывоз') || $value === 'pickup') {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>|null  $dimensions
     * @return array{dimensions_cm: array{length: int, width: int, height: int}, weight_kg: float, package_size: ?string}
     */
    public static function resolve(?string $preset, ?array $dimensions, mixed $weightKg): array
    {
        $key = is_string($preset) ? strtolower($preset) : '';
        if (isset(self::PRESETS[$key])) {
            $row = self::PRESETS[$key];

            return [
                'dimensions_cm' => [
                    'length' => $row['length'],
                    'width' => $row['width'],
                    'height' => $row['height'],
                ],
                'weight_kg' => $row['weight_kg'],
                'package_size' => $key,
            ];
        }

        $length = (int) ($dimensions['length'] ?? 0);
        $width = (int) ($dimensions['width'] ?? 0);
        $height = (int) ($dimensions['height'] ?? 0);
        $weight = (float) $weightKg;

        return [
            'dimensions_cm' => [
                'length' => max(1, $length),
                'width' => max(1, $width),
                'height' => max(1, $height),
            ],
            'weight_kg' => max(0.01, $weight),
            'package_size' => null,
        ];
    }

    /**
     * @return array{dimensions_cm: array{length: int, width: int, height: int}, weight_kg: float, package_size: ?string}
     */
    public static function fromListing(Listing $listing): array
    {
        return self::resolve(
            $listing->package_size,
            is_array($listing->dimensions_cm) ? $listing->dimensions_cm : null,
            $listing->weight_kg,
        );
    }

    public static function isComplete(array $parcel): bool
    {
        $dims = $parcel['dimensions_cm'] ?? [];

        return (int) ($dims['length'] ?? 0) > 0
            && (int) ($dims['width'] ?? 0) > 0
            && (int) ($dims['height'] ?? 0) > 0
            && (float) ($parcel['weight_kg'] ?? 0) > 0;
    }
}
