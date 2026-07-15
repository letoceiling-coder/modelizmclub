<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channel_post_media', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('channel_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('type', 16)->default('image');
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->timestamps();
        });

        Schema::table('channel_posts', function (Blueprint $table): void {
            // Points at the feed Post this channel post was duplicated into
            // (channel posts always mirror into the main feed on publish).
            $table->foreignId('feed_post_id')->nullable()->after('author_id')->constrained('posts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('channel_posts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('feed_post_id');
        });
        Schema::dropIfExists('channel_post_media');
    }
};
