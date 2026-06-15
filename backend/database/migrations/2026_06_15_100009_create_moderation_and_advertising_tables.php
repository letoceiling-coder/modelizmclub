<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('moderation_queue', function (Blueprint $table) {
            $table->id();
            $table->string('moderatable_type');
            $table->unsignedBigInteger('moderatable_id');
            $table->string('queue', 32);
            $table->unsignedTinyInteger('priority')->default(0);
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 32)->default('pending');
            $table->timestamps();

            $table->index(['queue', 'status', 'priority']);
            $table->index(['moderatable_type', 'moderatable_id']);
        });

        Schema::create('moderation_actions', function (Blueprint $table) {
            $table->id();
            $table->string('moderatable_type');
            $table->unsignedBigInteger('moderatable_id');
            $table->foreignId('actor_id')->constrained('users')->cascadeOnDelete();
            $table->string('action', 32);
            $table->text('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['moderatable_type', 'moderatable_id']);
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('reportable_type');
            $table->unsignedBigInteger('reportable_id');
            $table->string('reason', 64);
            $table->text('description')->nullable();
            $table->string('status', 32)->default('pending');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['reportable_type', 'reportable_id']);
        });

        Schema::create('moderation_stop_words', function (Blueprint $table) {
            $table->id();
            $table->string('word');
            $table->boolean('is_regex')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('moderation_banned_patterns', function (Blueprint $table) {
            $table->id();
            $table->string('pattern');
            $table->string('type', 32)->default('url');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('placement', 32);
            $table->string('title');
            $table->foreignId('image_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('link_url')->nullable();
            $table->text('text')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('impressions_count')->default(0);
            $table->unsignedBigInteger('clicks_count')->default(0);
            $table->timestamps();

            $table->index(['placement', 'is_active']);
        });

        Schema::create('banner_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('banner_id')->constrained()->cascadeOnDelete();
            $table->string('event', 32);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['banner_id', 'event', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banner_events');
        Schema::dropIfExists('banners');
        Schema::dropIfExists('moderation_banned_patterns');
        Schema::dropIfExists('moderation_stop_words');
        Schema::dropIfExists('reports');
        Schema::dropIfExists('moderation_actions');
        Schema::dropIfExists('moderation_queue');
    }
};
