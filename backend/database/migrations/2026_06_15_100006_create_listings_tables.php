<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listings', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('listing_categories')->restrictOnDelete();
            $table->foreignId('subcategory_id')->nullable()->constrained('listing_categories')->nullOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->text('description');
            $table->unsignedBigInteger('price_cents')->default(0);
            $table->char('currency', 3)->default('RUB');
            $table->foreignId('city_id')->nullable()->constrained('cities')->nullOnDelete();
            $table->string('status', 32)->default('draft');
            $table->text('rejection_reason')->nullable();
            $table->json('delivery_methods')->nullable();
            $table->boolean('contact_via_messenger')->default(true);
            $table->unsignedInteger('views_count')->default(0);
            $table->unsignedInteger('favorites_count')->default(0);
            $table->timestamp('paid_until')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('sold_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->json('ai_draft')->nullable();
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['user_id', 'slug']);
            $table->index(['status', 'published_at']);
            $table->index(['category_id', 'city_id', 'status']);
        });

        Schema::create('listing_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('listing_favorites', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('listing_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['user_id', 'listing_id']);
        });

        Schema::create('listing_status_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('comment')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('listing_promotions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->timestamp('paid_until');
            $table->timestamps();
        });

        Schema::create('listing_pricing_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained('listing_categories')->nullOnDelete();
            $table->unsignedInteger('base_price_cents')->default(0);
            $table->unsignedSmallInteger('duration_days')->default(30);
            $table->unsignedSmallInteger('max_active_listings_free')->default(0);
            $table->json('settings')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_pricing_rules');
        Schema::dropIfExists('listing_promotions');
        Schema::dropIfExists('listing_status_logs');
        Schema::dropIfExists('listing_favorites');
        Schema::dropIfExists('listing_media');
        Schema::dropIfExists('listings');
    }
};
