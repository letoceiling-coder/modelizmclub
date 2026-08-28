<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_profiles', function (Blueprint $table): void {
            $table->unsignedInteger('reviews_count')->default(0)->after('rating_score');
            $table->unsignedInteger('deals_count')->default(0)->after('reviews_count');
        });
    }

    public function down(): void
    {
        Schema::table('user_profiles', function (Blueprint $table): void {
            $table->dropColumn(['reviews_count', 'deals_count']);
        });
    }
};
