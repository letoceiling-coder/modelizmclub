<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('channels', function (Blueprint $table): void {
            $table->boolean('comments_enabled')->default(true)->after('is_active');
            $table->text('rules')->nullable()->after('description');
            $table->text('contacts')->nullable()->after('rules');
        });

        Schema::table('channel_posts', function (Blueprint $table): void {
            $table->timestamp('pinned_at')->nullable()->after('published_at');
            $table->index(['channel_id', 'pinned_at']);
        });

        Schema::table('channel_applications', function (Blueprint $table): void {
            $table->string('proposed_slug', 80)->nullable()->after('proposed_name');
            $table->string('proposed_kind', 32)->nullable()->after('category');
            $table->boolean('comments_enabled')->default(true)->after('proposed_kind');
        });

        Schema::create('channel_post_likes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('channel_post_id')->constrained('channel_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['channel_post_id', 'user_id']);
        });

        Schema::create('channel_post_views', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('channel_post_id')->constrained('channel_posts')->cascadeOnDelete();
            $table->string('viewer_key', 80);
            $table->timestamps();
            $table->unique(['channel_post_id', 'viewer_key']);
        });

        Schema::create('channel_admins', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('channel_id')->constrained('channels')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['channel_id', 'user_id']);
        });

        // Channel likes/views were never recorded — drop seeded inflation.
        DB::table('channel_posts')->update([
            'likes_count' => 0,
            'views_count' => 0,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('channel_admins');
        Schema::dropIfExists('channel_post_views');
        Schema::dropIfExists('channel_post_likes');

        Schema::table('channel_applications', function (Blueprint $table): void {
            $table->dropColumn(['proposed_slug', 'proposed_kind', 'comments_enabled']);
        });

        Schema::table('channel_posts', function (Blueprint $table): void {
            $table->dropIndex(['channel_id', 'pinned_at']);
            $table->dropColumn('pinned_at');
        });

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropColumn(['comments_enabled', 'rules', 'contacts']);
        });
    }
};
