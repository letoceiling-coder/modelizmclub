<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('communities', function (Blueprint $table): void {
            $table->foreignId('city_id')->nullable()->after('category_id')->constrained('cities')->nullOnDelete();
            $table->string('access_type', 16)->default('open')->after('is_official');
            $table->string('custom_category', 120)->nullable()->after('access_type');
            $table->text('rules')->nullable()->after('description');
            $table->json('contacts')->nullable()->after('settings');
        });

        Schema::table('community_applications', function (Blueprint $table): void {
            $table->json('payload')->nullable()->after('category_id');
        });

        Schema::table('community_members', function (Blueprint $table): void {
            $table->unsignedBigInteger('last_read_post_id')->nullable();
        });

        Schema::create('community_topic_categories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('community_id')->constrained('communities')->cascadeOnDelete();
            $table->foreignId('post_category_id')->constrained('post_categories')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['community_id', 'post_category_id']);
        });

        Schema::create('community_join_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('community_id')->constrained('communities')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 16)->default('pending');
            $table->text('message')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->unique(['community_id', 'user_id']);
        });

        Schema::create('community_events', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('community_id')->constrained('communities')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamp('starts_at');
            $table->string('location_name', 255)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->foreignId('cover_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->timestamps();
            $table->index(['community_id', 'starts_at']);
        });

        Schema::create('community_event_attendees', function (Blueprint $table): void {
            $table->foreignId('event_id')->constrained('community_events')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['event_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_event_attendees');
        Schema::dropIfExists('community_events');
        Schema::dropIfExists('community_join_requests');
        Schema::dropIfExists('community_topic_categories');

        Schema::table('community_members', function (Blueprint $table): void {
            $table->dropColumn('last_read_post_id');
        });

        Schema::table('community_applications', function (Blueprint $table): void {
            $table->dropColumn('payload');
        });

        Schema::table('communities', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('city_id');
            $table->dropColumn(['access_type', 'custom_category', 'rules', 'contacts']);
        });
    }
};
