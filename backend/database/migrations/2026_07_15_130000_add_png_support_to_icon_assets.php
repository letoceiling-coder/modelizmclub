<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('icon_assets', function (Blueprint $table): void {
            $table->string('format', 8)->default('svg')->after('name');
            $table->foreignId('media_id')->nullable()->after('svg')->constrained('media')->nullOnDelete();
            $table->unique('media_id');
        });

        Schema::table('icon_assets', function (Blueprint $table): void {
            $table->text('svg')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('icon_assets', function (Blueprint $table): void {
            $table->dropUnique(['media_id']);
            $table->dropConstrainedForeignId('media_id');
            $table->dropColumn('format');
        });
    }
};
