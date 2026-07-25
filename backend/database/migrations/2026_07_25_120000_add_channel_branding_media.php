<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('channels', function (Blueprint $table): void {
            $table->foreignId('avatar_media_id')->nullable()->after('avatar_color')->constrained('media')->nullOnDelete();
            $table->foreignId('banner_media_id')->nullable()->after('banner_color')->constrained('media')->nullOnDelete();
        });

        Schema::table('channel_applications', function (Blueprint $table): void {
            $table->foreignId('avatar_media_id')->nullable()->after('category')->constrained('media')->nullOnDelete();
            $table->foreignId('banner_media_id')->nullable()->after('avatar_media_id')->constrained('media')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('channel_applications', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('banner_media_id');
            $table->dropConstrainedForeignId('avatar_media_id');
        });

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('banner_media_id');
            $table->dropConstrainedForeignId('avatar_media_id');
        });
    }
};
