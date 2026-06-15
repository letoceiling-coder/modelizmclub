<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('communities', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('category_id')->constrained('community_categories')->restrictOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->foreignId('cover_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('avatar_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('status', 32)->default('pending');
            $table->boolean('is_official')->default(false);
            $table->unsignedInteger('members_count')->default(0);
            $table->unsignedInteger('posts_count')->default(0);
            $table->json('settings')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'category_id']);
        });

        Schema::create('community_subcategories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['community_id', 'slug']);
        });

        Schema::create('community_members', function (Blueprint $table) {
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32)->default('member');
            $table->timestamp('joined_at')->useCurrent();

            $table->primary(['community_id', 'user_id']);
        });

        Schema::create('community_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('proposed_name');
            $table->text('description')->nullable();
            $table->foreignId('category_id')->constrained('community_categories')->restrictOnDelete();
            $table->string('status', 32)->default('pending');
            $table->text('moderator_comment')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_applications');
        Schema::dropIfExists('community_members');
        Schema::dropIfExists('community_subcategories');
        Schema::dropIfExists('communities');
    }
};
