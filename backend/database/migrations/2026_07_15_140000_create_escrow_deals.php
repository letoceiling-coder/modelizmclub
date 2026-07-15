<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('escrow_deals', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('listing_id')->constrained()->cascadeOnDelete();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('amount_cents');
            $table->unsignedInteger('seller_payout_cents');
            $table->unsignedInteger('platform_fee_cents')->default(0);
            $table->string('currency', 3)->default('RUB');
            $table->string('status', 32)->default('pending_payment');
            $table->string('yookassa_deal_id')->nullable();
            $table->string('yookassa_payment_id')->nullable();
            $table->string('yookassa_payout_id')->nullable();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['buyer_id', 'status']);
            $table->index(['seller_id', 'status']);
            $table->index('yookassa_deal_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('escrow_deals');
    }
};
