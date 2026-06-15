<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('community_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('subcategory_id')->nullable()->constrained('community_subcategories')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('post_categories')->nullOnDelete();
            $table->string('title');
            $table->text('body');
            $table->string('status', 32)->default('draft');
            $table->text('rejection_reason')->nullable();
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('moderated_at')->nullable();
            $table->foreignId('repost_of_id')->nullable()->constrained('posts')->nullOnDelete();
            $table->unsignedInteger('views_count')->default(0);
            $table->unsignedInteger('reactions_count')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'published_at']);
            $table->index(['community_id', 'status']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('post_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('type', 16)->default('image');
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->timestamps();
        });

        Schema::create('post_hashtags', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();

            $table->primary(['post_id', 'tag_id']);
        });

        Schema::create('post_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32)->default('like');
            $table->timestamps();

            $table->unique(['post_id', 'user_id']);
        });

        Schema::create('post_bookmarks', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['user_id', 'post_id']);
        });

        Schema::create('post_reposts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('original_post_id')->constrained('posts')->cascadeOnDelete();
            $table->foreignId('repost_post_id')->nullable()->constrained('posts')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('commentable_type');
            $table->unsignedBigInteger('commentable_id');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('comments')->cascadeOnDelete();
            $table->foreignId('root_id')->nullable()->constrained('comments')->cascadeOnDelete();
            $table->unsignedTinyInteger('depth')->default(0);
            $table->text('body');
            $table->string('status', 32)->default('published');
            $table->unsignedInteger('reactions_count')->default(0);
            $table->timestamp('moderated_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['commentable_type', 'commentable_id']);
            $table->index(['root_id', 'created_at']);
        });

        Schema::create('comment_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32)->default('like');
            $table->timestamps();

            $table->unique(['comment_id', 'user_id']);
        });

        Schema::create('community_pinned_posts', function (Blueprint $table) {
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamp('pinned_at')->useCurrent();

            $table->primary(['community_id', 'post_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_pinned_posts');
        Schema::dropIfExists('comment_reactions');
        Schema::dropIfExists('comments');
        Schema::dropIfExists('post_reposts');
        Schema::dropIfExists('post_bookmarks');
        Schema::dropIfExists('post_reactions');
        Schema::dropIfExists('post_hashtags');
        Schema::dropIfExists('post_media');
        Schema::dropIfExists('posts');
    }
};
