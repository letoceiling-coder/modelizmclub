<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cities', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('region')->nullable();
            $table->string('slug')->unique();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedInteger('usage_count')->default(0);
            $table->timestamps();
        });

        Schema::create('taggables', function (Blueprint $table) {
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->string('taggable_type');
            $table->unsignedBigInteger('taggable_id');

            $table->primary(['tag_id', 'taggable_type', 'taggable_id']);
            $table->index(['taggable_type', 'taggable_id']);
        });

        Schema::create('delivery_methods', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        foreach (['post_categories', 'community_categories', 'listing_categories'] as $tableName) {
            Schema::create($tableName, function (Blueprint $table) use ($tableName) {
                $table->id();
                $table->foreignId('parent_id')->nullable()->constrained($tableName)->nullOnDelete();
                $table->string('name');
                $table->string('slug');
                $table->string('icon')->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->unsignedTinyInteger('depth')->default(0);
                $table->string('path')->nullable();
                $table->boolean('is_active')->default(true);
                if ($tableName === 'listing_categories') {
                    $table->unsignedInteger('listing_price_cents')->nullable();
                }
                $table->timestamps();

                $table->unique(['parent_id', 'slug']);
                $table->index(['is_active', 'sort_order']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_categories');
        Schema::dropIfExists('community_categories');
        Schema::dropIfExists('post_categories');
        Schema::dropIfExists('delivery_methods');
        Schema::dropIfExists('taggables');
        Schema::dropIfExists('tags');
        Schema::dropIfExists('cities');
    }
};
