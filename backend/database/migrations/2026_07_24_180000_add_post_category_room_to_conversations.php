<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->foreignId('post_category_id')
                ->nullable()
                ->after('community_id')
                ->constrained('post_categories')
                ->nullOnDelete();

            $table->unique(['type', 'post_category_id']);
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropUnique(['type', 'post_category_id']);
            $table->dropConstrainedForeignId('post_category_id');
        });
    }
};
