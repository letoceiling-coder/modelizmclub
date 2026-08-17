<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('safe_deals', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('listing_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->bigInteger('amount_kopecks');
            $table->bigInteger('platform_fee_kopecks')->default(0);
            $table->bigInteger('seller_payout_kopecks');
            $table->string('currency', 3)->default('RUB');
            $table->string('status', 30)->default('created');
            $table->foreignId('hold_transaction_id')->nullable()->constrained('wallet_transactions')->nullOnDelete();
            $table->foreignId('payout_transaction_id')->nullable()->constrained('wallet_transactions')->nullOnDelete();
            $table->foreignId('refund_transaction_id')->nullable()->constrained('wallet_transactions')->nullOnDelete();
            $table->string('delivery_method', 50)->nullable();
            $table->string('tracking_number')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('auto_release_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['buyer_id', 'status']);
            $table->index(['seller_id', 'status']);
        });

        Schema::create('escrow_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('safe_deal_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 40); // status transition or money movement
            $table->bigInteger('amount_kopecks')->nullable();
            $table->foreignId('wallet_transaction_id')->nullable()->constrained('wallet_transactions')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['safe_deal_id', 'type']);
        });

        Schema::create('disputes', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('safe_deal_id')->constrained()->cascadeOnDelete();
            $table->foreignId('opened_by')->constrained('users')->cascadeOnDelete();
            $table->string('reason', 100);
            $table->text('description')->nullable();
            $table->string('status', 30)->default('open');
            $table->text('resolution')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->json('evidence')->nullable();
            $table->timestamps();

            $table->index(['safe_deal_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disputes');
        Schema::dropIfExists('escrow_transactions');
        Schema::dropIfExists('safe_deals');
    }
};
