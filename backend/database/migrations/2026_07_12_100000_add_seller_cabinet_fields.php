<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_profiles', function (Blueprint $table) {
            $table->string('vk_url', 512)->nullable()->after('bio');
            $table->string('telegram_url', 512)->nullable()->after('vk_url');
            $table->string('website_url', 512)->nullable()->after('telegram_url');
        });

        Schema::create('user_payout_requisites', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->text('payout_card_number')->nullable();
            $table->timestamps();
        });

        Schema::create('saved_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('provider_token');
            $table->string('brand', 32)->default('card');
            $table->string('last4', 4);
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'is_default']);
        });

        Schema::create('listing_view_daily', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained()->cascadeOnDelete();
            $table->date('view_date');
            $table->unsignedInteger('views_count')->default(0);
            $table->timestamps();

            $table->unique(['listing_id', 'view_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_view_daily');
        Schema::dropIfExists('saved_payment_methods');
        Schema::dropIfExists('user_payout_requisites');

        Schema::table('user_profiles', function (Blueprint $table) {
            $table->dropColumn(['vk_url', 'telegram_url', 'website_url']);
        });
    }
};
