<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_delivery_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('point_type', 32);
            $table->string('external_point_id');
            $table->string('label')->nullable();
            $table->json('address')->nullable();
            $table->foreignId('city_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'provider', 'external_point_id']);
            $table->index(['user_id', 'provider', 'is_active']);
        });

        Schema::create('shipments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('listing_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('status', 32)->default('draft');
            $table->foreignId('seller_point_id')->nullable()->constrained('seller_delivery_profiles')->nullOnDelete();
            $table->json('source_point')->nullable();
            $table->json('destination_point');
            $table->decimal('weight_kg', 8, 3)->nullable();
            $table->json('dimensions_cm')->nullable();
            $table->unsignedInteger('delivery_cost_cents')->nullable();
            $table->string('currency', 3)->default('RUB');
            $table->string('tracking_number')->nullable();
            $table->string('external_id')->nullable();
            $table->string('external_status')->nullable();
            $table->timestamp('quoted_at')->nullable();
            $table->timestamp('created_at_provider')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->json('raw_payload')->nullable();
            $table->text('error_message')->nullable();
            $table->text('admin_note')->nullable();
            $table->timestamps();

            $table->index(['seller_id', 'status']);
            $table->index(['buyer_id', 'status']);
            $table->index(['provider', 'status']);
            $table->index('tracking_number');
        });

        Schema::create('shipment_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->string('status', 32);
            $table->string('provider_status')->nullable();
            $table->text('message')->nullable();
            $table->timestamp('occurred_at');
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['shipment_id', 'occurred_at']);
        });

        Schema::create('delivery_quotes', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('shipment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider', 32);
            $table->json('source_point');
            $table->json('destination_point');
            $table->json('parcels');
            $table->unsignedInteger('price_cents');
            $table->string('tariff_code')->nullable();
            $table->string('currency', 3)->default('RUB');
            $table->timestamp('expires_at');
            $table->json('raw_payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_quotes');
        Schema::dropIfExists('shipment_events');
        Schema::dropIfExists('shipments');
        Schema::dropIfExists('seller_delivery_profiles');
    }
};
