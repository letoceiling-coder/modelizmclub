<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table): void {
            $table->foreignId('post_id')->nullable()->after('listing_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('post_id');
        });
    }
};
