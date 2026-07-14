<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_profiles', function (Blueprint $table) {
            $table->foreignId('cover_media_id')->nullable()->after('avatar_media_id')->constrained('media')->nullOnDelete();
        });

        Schema::create('user_document_requisites', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->string('full_name')->nullable();
            $table->string('inn', 32)->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('address', 512)->nullable();
            $table->timestamps();
        });

        Schema::create('user_view_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16);
            $table->string('target_uuid', 36);
            $table->string('title');
            $table->string('thumb', 2048)->nullable();
            $table->timestamp('viewed_at');
            $table->timestamps();

            $table->unique(['user_id', 'kind', 'target_uuid']);
            $table->index(['user_id', 'viewed_at']);
        });

        Schema::create('user_reviews', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('target_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('text')->nullable();
            $table->timestamps();

            $table->index(['target_user_id', 'created_at']);
        });

        Schema::create('pending_email_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('new_email');
            $table->string('code_hash');
            $table->timestamp('expires_at');
            $table->timestamps();
        });

        Schema::create('video_categories', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('slug', 100)->unique();
            $table->string('title');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('videos', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('video_categories')->nullOnDelete();
            $table->foreignId('poster_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('video_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->unsignedInteger('views_count')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->json('tags')->nullable();
            $table->foreignId('uploader_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('processing');
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'published_at']);
        });

        Schema::create('video_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('video_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 16)->default('like');
            $table->timestamps();

            $table->unique(['video_id', 'user_id']);
        });

        Schema::create('video_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('video_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('viewer_key', 64);
            $table->timestamp('viewed_at');
            $table->timestamps();

            $table->index(['video_id', 'viewer_key', 'viewed_at']);
        });

        Schema::create('media_transcripts', function (Blueprint $table) {
            $table->foreignId('media_id')->primary()->constrained()->cascadeOnDelete();
            $table->text('text')->nullable();
            $table->string('lang', 8)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_transcripts');
        Schema::dropIfExists('video_views');
        Schema::dropIfExists('video_reactions');
        Schema::dropIfExists('videos');
        Schema::dropIfExists('video_categories');
        Schema::dropIfExists('pending_email_changes');
        Schema::dropIfExists('user_reviews');
        Schema::dropIfExists('user_view_history');
        Schema::dropIfExists('user_document_requisites');

        Schema::table('user_profiles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cover_media_id');
        });
    }
};
