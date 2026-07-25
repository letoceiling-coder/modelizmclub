<?php

namespace App\Support;

use App\Models\City;
use Modules\Catalog\Services\CatalogService;

final class RussianCitiesImporter
{
    /**
     * @return list<array{name: string, region: string, slug: string, sort_order: int}>
     */
    public static function loadDataset(): array
    {
        $jsonPath = database_path('data/russian_cities.json');
        if (is_readable($jsonPath)) {
            /** @var list<array{name: string, region: string, slug: string, sort_order: int}>|null $decoded */
            $decoded = json_decode((string) file_get_contents($jsonPath), true);

            if (is_array($decoded) && $decoded !== []) {
                return $decoded;
            }
        }

        /** @var list<array{name: string, region: string, slug: string, sort_order: int}> $legacy */
        $legacy = require database_path('data/russian_cities.php');

        return $legacy;
    }

    public static function import(bool $flushCache = true): int
    {
        $cities = self::loadDataset();
        $count = 0;

        foreach ($cities as $city) {
            City::query()->updateOrCreate(
                ['slug' => $city['slug']],
                array_merge($city, ['is_active' => true]),
            );
            $count++;
        }

        if ($flushCache) {
            CatalogService::flushCache();
        }

        return $count;
    }
}
