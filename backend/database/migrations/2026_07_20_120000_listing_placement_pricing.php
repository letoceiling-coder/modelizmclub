<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listing_categories', function (Blueprint $table): void {
            $table->unsignedInteger('subscriber_listing_price_cents')->nullable()->after('listing_price_cents');
        });

        Schema::table('promocodes', function (Blueprint $table): void {
            $table->string('scope', 32)->default('listing_placement')->after('type');
            $table->foreignId('listing_category_id')->nullable()->after('user_id')->constrained('listing_categories')->nullOnDelete();
        });

        Schema::table('listings', function (Blueprint $table): void {
            $table->foreignId('placement_payment_id')->nullable()->after('paid_until')->constrained('payments')->nullOnDelete();
            $table->unsignedInteger('placement_amount_cents')->nullable()->after('placement_payment_id');
            $table->boolean('placement_was_free')->default(false)->after('placement_amount_cents');
            $table->foreignId('placement_promocode_id')->nullable()->after('placement_was_free')->constrained('promocodes')->nullOnDelete();
        });

        SystemSetting::query()->updateOrCreate(
            ['key' => 'listing.placement.default_price_cents'],
            ['value' => ['cents' => 3000], 'group' => 'billing'],
        );
    }

    public function down(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('placement_promocode_id');
            $table->dropColumn('placement_was_free');
            $table->dropColumn('placement_amount_cents');
            $table->dropConstrainedForeignId('placement_payment_id');
        });

        Schema::table('promocodes', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('listing_category_id');
            $table->dropColumn('scope');
        });

        Schema::table('listing_categories', function (Blueprint $table): void {
            $table->dropColumn('subscriber_listing_price_cents');
        });
    }
};
