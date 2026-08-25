<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->string('package_size', 8)->nullable()->after('delivery_methods');
            $table->decimal('weight_kg', 8, 3)->nullable()->after('package_size');
            $table->json('dimensions_cm')->nullable()->after('weight_kg');
            $table->string('pickup_address', 255)->nullable()->after('dimensions_cm');
        });

        Schema::table('safe_deals', function (Blueprint $table): void {
            $table->unsignedInteger('delivery_cost_kopecks')->default(0)->after('seller_payout_kopecks');
            $table->string('delivery_status', 32)->nullable()->after('tracking_number');
            $table->foreignId('shipment_id')->nullable()->after('listing_id')->constrained('shipments')->nullOnDelete();
            $table->json('destination_point')->nullable()->after('delivery_method');
        });

        Schema::table('shipments', function (Blueprint $table): void {
            $table->foreignId('safe_deal_id')->nullable()->after('listing_id')->constrained('safe_deals')->nullOnDelete();
        });

        Schema::table('user_reviews', function (Blueprint $table): void {
            $table->foreignId('safe_deal_id')->nullable()->after('target_user_id')->constrained('safe_deals')->nullOnDelete();
            $table->unique(['safe_deal_id', 'author_id']);
        });

        $now = now();
        foreach ([
            ['code' => 'boxberry', 'name' => 'Боксберри', 'sort_order' => 35, 'is_integrated' => false],
            ['code' => 'pickup', 'name' => 'Самовывоз', 'sort_order' => 50, 'is_integrated' => false],
        ] as $row) {
            if (! \App\Models\DeliveryMethod::query()->where('code', $row['code'])->exists()) {
                \App\Models\DeliveryMethod::query()->create(array_merge($row, [
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]));
            }
        }
    }

    public function down(): void
    {
        Schema::table('user_reviews', function (Blueprint $table): void {
            $table->dropUnique(['safe_deal_id', 'author_id']);
            $table->dropConstrainedForeignId('safe_deal_id');
        });

        Schema::table('shipments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('safe_deal_id');
        });

        Schema::table('safe_deals', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('shipment_id');
            $table->dropColumn(['delivery_cost_kopecks', 'delivery_status', 'destination_point']);
        });

        Schema::table('listings', function (Blueprint $table): void {
            $table->dropColumn(['package_size', 'weight_kg', 'dimensions_cm', 'pickup_address']);
        });
    }
};
