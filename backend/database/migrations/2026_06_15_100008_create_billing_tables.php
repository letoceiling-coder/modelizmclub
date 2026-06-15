<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('price_cents')->default(0);
            $table->unsignedSmallInteger('period_days')->default(30);
            $table->json('features')->nullable();
            $table->unsignedTinyInteger('max_photos_per_post')->default(10);
            $table->unsignedSmallInteger('free_listings_per_month')->default(0);
            $table->unsignedTinyInteger('listing_discount_percent')->default(0);
            $table->boolean('priority_boost')->default(false);
            $table->string('badge_label')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('user_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('subscription_plans')->restrictOnDelete();
            $table->string('status', 32)->default('active');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->boolean('auto_renew')->default(true);
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount_cents');
            $table->char('currency', 3)->default('RUB');
            $table->string('status', 32)->default('pending');
            $table->string('provider', 32)->nullable();
            $table->string('provider_payment_id')->nullable();
            $table->string('idempotency_key')->nullable()->unique();
            $table->timestamp('paid_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('payment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->string('payable_type');
            $table->unsignedBigInteger('payable_id');
            $table->string('description');
            $table->unsignedInteger('amount_cents');
            $table->timestamps();

            $table->index(['payable_type', 'payable_id']);
        });

        Schema::create('promocodes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('type', 32);
            $table->unsignedInteger('value')->default(0);
            $table->unsignedInteger('max_usages')->nullable();
            $table->unsignedInteger('max_usages_per_user')->default(1);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('valid_from')->nullable();
            $table->timestamp('valid_until')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('promocode_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promocode_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('used_at')->useCurrent();
        });

        Schema::create('bonus_accounts', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->integer('balance')->default(0);
            $table->timestamps();
        });

        Schema::create('bonus_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_user_id')->constrained('bonus_accounts', 'user_id')->cascadeOnDelete();
            $table->integer('amount');
            $table->string('type', 32);
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('description')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['account_user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bonus_transactions');
        Schema::dropIfExists('bonus_accounts');
        Schema::dropIfExists('promocode_usages');
        Schema::dropIfExists('promocodes');
        Schema::dropIfExists('payment_items');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('user_subscriptions');
        Schema::dropIfExists('subscription_plans');
    }
};
