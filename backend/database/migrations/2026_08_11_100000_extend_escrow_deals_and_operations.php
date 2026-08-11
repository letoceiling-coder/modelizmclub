<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('escrow_deals', function (Blueprint $table): void {
            $table->foreignId('shipment_id')->nullable()->after('payment_id')->constrained()->nullOnDelete();
            $table->unsignedInteger('item_amount_cents')->nullable()->after('amount_cents');
            $table->unsignedInteger('delivery_amount_cents')->default(0)->after('item_amount_cents');
            $table->string('payment_provider', 32)->default('yookassa')->after('currency');
            $table->string('vtb_order_id')->nullable()->after('yookassa_payout_id');
            $table->string('vtb_payment_state', 64)->nullable()->after('vtb_order_id');
            $table->unsignedInteger('captured_cents')->default(0)->after('platform_fee_cents');
            $table->unsignedInteger('refunded_cents')->default(0)->after('captured_cents');
            $table->unsignedInteger('paid_out_cents')->default(0)->after('refunded_cents');
            $table->json('fee_snapshot')->nullable()->after('metadata');
            $table->timestamp('frozen_at')->nullable()->after('completed_at');
            $table->string('freeze_reason', 512)->nullable()->after('frozen_at');
            $table->string('dispute_status', 32)->default('none')->after('freeze_reason');
            $table->text('admin_note')->nullable()->after('dispute_status');

            $table->index('shipment_id');
            $table->index('payment_provider');
            $table->index('vtb_order_id');
            $table->index('dispute_status');
        });

        Schema::create('escrow_operations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('escrow_deal_id')->constrained()->cascadeOnDelete();
            $table->string('type', 64);
            $table->unsignedInteger('amount_cents')->nullable();
            $table->string('currency', 3)->default('RUB');
            $table->string('status', 32)->default('pending');
            $table->string('provider', 32)->default('internal');
            $table->string('provider_reference')->nullable();
            $table->string('initiated_by', 32)->default('system');
            $table->foreignId('admin_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('idempotency_key', 128)->unique();
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();
            $table->text('error_message')->nullable();
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index(['escrow_deal_id', 'type']);
            $table->index(['escrow_deal_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('escrow_operations');

        Schema::table('escrow_deals', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('shipment_id');
            $table->dropColumn([
                'item_amount_cents',
                'delivery_amount_cents',
                'payment_provider',
                'vtb_order_id',
                'vtb_payment_state',
                'captured_cents',
                'refunded_cents',
                'paid_out_cents',
                'fee_snapshot',
                'frozen_at',
                'freeze_reason',
                'dispute_status',
                'admin_note',
            ]);
        });
    }
};
