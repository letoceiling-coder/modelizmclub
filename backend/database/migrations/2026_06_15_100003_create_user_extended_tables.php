<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->string('display_name');
            $table->string('slug')->unique();
            $table->foreignId('avatar_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('city_id')->nullable()->constrained('cities')->nullOnDelete();
            $table->text('bio')->nullable();
            $table->unsignedInteger('publications_count')->default(0);
            $table->unsignedInteger('followers_count')->default(0);
            $table->unsignedInteger('following_count')->default(0);
            $table->decimal('rating_score', 8, 2)->default(0);
            $table->json('privacy_settings')->nullable();
            $table->timestamps();
        });

        Schema::create('user_oauth_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('provider_user_id');
            $table->json('token')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_user_id']);
        });

        Schema::create('user_interests', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('post_categories')->cascadeOnDelete();

            $table->primary(['user_id', 'category_id']);
        });

        Schema::create('user_follows', function (Blueprint $table) {
            $table->foreignId('follower_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('following_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['follower_id', 'following_id']);
        });

        Schema::create('user_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blocker_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('blocked_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->unique(['blocker_id', 'blocked_id']);
        });

        Schema::create('personal_data_consents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('document_version', 32);
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('accepted_at');
            $table->timestamps();
        });

        Schema::create('admin_two_factor', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->text('secret');
            $table->json('recovery_codes')->nullable();
            $table->timestamp('enabled_at')->nullable();
            $table->timestamps();
        });

        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('channel', 32);
            $table->string('type', 64);
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'channel', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('admin_two_factor');
        Schema::dropIfExists('personal_data_consents');
        Schema::dropIfExists('user_blocks');
        Schema::dropIfExists('user_follows');
        Schema::dropIfExists('user_interests');
        Schema::dropIfExists('user_oauth_accounts');
        Schema::dropIfExists('user_profiles');
    }
};
