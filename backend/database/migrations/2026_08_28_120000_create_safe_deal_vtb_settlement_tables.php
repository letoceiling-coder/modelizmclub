<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_payout_requisites', function (Blueprint $table): void {
            $table->string('preferred_channel', 8)->default('sbp')->after('payout_card_number');
            $table->text('sbp_phone')->nullable()->after('preferred_channel');
            $table->string('sbp_bank_id', 20)->nullable()->after('sbp_phone');
            $table->string('sbp_bank_name', 80)->nullable()->after('sbp_bank_id');
            $table->string('sbp_full_name', 255)->nullable()->after('sbp_bank_name');
            $table->string('card_last4', 4)->nullable()->after('sbp_full_name');
        });

        Schema::create('safe_deal_incoming_payments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('safe_deal_id')->constrained('safe_deals')->cascadeOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('amount_kopecks');
            $table->char('currency', 3)->default('RUB');
            $table->string('status', 24)->default('pending');
            $table->string('capture_mode', 16)->default('one_stage');
            $table->string('rbs_order_id', 64)->nullable();
            $table->string('rbs_order_number', 64)->nullable();
            $table->unsignedTinyInteger('rbs_order_status')->nullable();
            $table->text('checkout_url')->nullable();
            $table->string('ofd_receipt_id', 64)->nullable();
            $table->string('ofd_status', 32)->nullable();
            $table->json('ofd_payload')->nullable();
            $table->string('fail_reason', 255)->nullable();
            $table->timestamp('authorized_at')->nullable();
            $table->timestamp('captured_at')->nullable();
            $table->timestamp('reversed_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('last_callback_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['safe_deal_id', 'status']);
            $table->unique('rbs_order_id');
        });

        Schema::create('safe_deal_payouts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('safe_deal_id')->constrained('safe_deals')->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->string('channel', 8);
            $table->string('status', 24)->default('created');
            $table->unsignedBigInteger('amount_kopecks');
            $table->unsignedBigInteger('commission_kopecks')->default(0);
            $table->char('currency', 3)->default('RUB');
            $table->string('request_id', 50);
            $table->string('operation_id', 50)->nullable();
            $table->string('provider_order_id', 64)->nullable();
            $table->string('provider_order_code', 64)->nullable();
            $table->string('bank_status', 32)->nullable();
            $table->string('payment_purpose', 255)->nullable();
            $table->text('sbp_phone')->nullable();
            $table->string('sbp_bank_id', 20)->nullable();
            $table->string('sbp_full_name', 255)->nullable();
            $table->text('sbp_pam')->nullable();
            $table->string('card_last4', 4)->nullable();
            $table->string('nspk_response_code', 32)->nullable();
            $table->string('nspk_response_message', 255)->nullable();
            $table->string('decline_reason', 255)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('declined_at')->nullable();
            $table->timestamp('last_callback_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique('request_id');
            $table->index(['safe_deal_id', 'status']);
            $table->index(['seller_id', 'channel']);
        });

        Schema::create('safe_deal_gateway_events', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('contour', 8);
            $table->string('event_type', 64);
            $table->foreignId('safe_deal_id')->nullable()->constrained('safe_deals')->nullOnDelete();
            $table->foreignId('incoming_payment_id')->nullable()->constrained('safe_deal_incoming_payments')->nullOnDelete();
            $table->foreignId('payout_id')->nullable()->constrained('safe_deal_payouts')->nullOnDelete();
            $table->string('idempotency_key', 80)->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['contour', 'event_type']);
            $table->unique(['contour', 'event_type', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('safe_deal_gateway_events');
        Schema::dropIfExists('safe_deal_payouts');
        Schema::dropIfExists('safe_deal_incoming_payments');

        Schema::table('user_payout_requisites', function (Blueprint $table): void {
            $table->dropColumn([
                'preferred_channel',
                'sbp_phone',
                'sbp_bank_id',
                'sbp_bank_name',
                'sbp_full_name',
                'card_last4',
            ]);
        });
    }
};
