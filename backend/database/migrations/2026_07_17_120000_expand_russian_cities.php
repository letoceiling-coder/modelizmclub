<?php

use App\Models\City;
use Illuminate\Database\Migrations\Migration;
use Modules\Catalog\Services\CatalogService;

return new class extends Migration
{
    public function up(): void
    {
        /** @var list<array{name: string, region: string, slug: string, sort_order: int}> $cities */
        $cities = require database_path('data/russian_cities.php');

        foreach ($cities as $city) {
            City::query()->updateOrCreate(
                ['slug' => $city['slug']],
                array_merge($city, ['is_active' => true]),
            );
        }

        CatalogService::flushCache();
    }

    public function down(): void
    {
        // Keep expanded city list on rollback — removing cities could break listings.
    }
};
