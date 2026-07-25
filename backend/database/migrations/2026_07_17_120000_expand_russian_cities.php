<?php

use App\Support\RussianCitiesImporter;
use Illuminate\Database\Migrations\Migration;
use Modules\Catalog\Services\CatalogService;

return new class extends Migration
{
    public function up(): void
    {
        RussianCitiesImporter::import();
    }

    public function down(): void
    {
        // Keep expanded city list on rollback — removing cities could break listings.
    }
};
