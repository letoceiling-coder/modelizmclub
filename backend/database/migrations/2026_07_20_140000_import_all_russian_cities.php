<?php

use App\Support\RussianCitiesImporter;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        RussianCitiesImporter::import();
    }

    public function down(): void
    {
        // Keep the expanded directory — removing cities could break user profiles/listings.
    }
};
