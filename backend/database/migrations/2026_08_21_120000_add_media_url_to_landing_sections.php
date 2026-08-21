<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landing_sections', function (Blueprint $table): void {
            $table->string('media_url', 500)->nullable()->after('subtitle');
        });

        (new \Database\Seeders\LandingPageSeeder())->run();
    }

    public function down(): void
    {
        Schema::table('landing_sections', function (Blueprint $table): void {
            $table->dropColumn('media_url');
        });
    }
};
