<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            // Kopecks to avoid floating point. May go slightly negative only via
            // controlled holds; guarded by WalletService.
            $table->bigInteger('balance_kopecks')->default(0);
            // Held funds (escrow holds) tracked separately for transparency.
            $table->bigInteger('held_kopecks')->default(0);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
        });

        Schema::create('wallet_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('wallet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50);
            $table->bigInteger('amount_kopecks'); // + credit, - debit
            $table->bigInteger('balance_before');
            $table->bigInteger('balance_after');
            $table->string('ref_type', 50)->nullable();
            $table->unsignedBigInteger('ref_id')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->text('description')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['wallet_id', 'created_at']);
            $table->index(['user_id', 'type']);
            $table->index(['ref_type', 'ref_id']);
            $table->unique('idempotency_key');
        });

        Schema::create('withdrawal_requests', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('amount_kopecks');
            $table->string('method', 30)->default('card'); // card|sbp|account
            $table->string('destination')->nullable(); // masked card / phone / account
            $table->string('status', 30)->default('pending'); // pending|processing|paid|rejected
            $table->foreignId('wallet_transaction_id')->nullable()->constrained('wallet_transactions')->nullOnDelete();
            $table->text('admin_comment')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('withdrawal_requests');
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('wallets');
    }
};
