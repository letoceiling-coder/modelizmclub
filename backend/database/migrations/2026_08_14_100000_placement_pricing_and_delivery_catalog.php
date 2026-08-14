<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_methods', function (Blueprint $table): void {
            $table->string('code', 32)->nullable()->unique()->after('id');
            $table->boolean('is_integrated')->default(false)->after('is_active');
        });

        SystemSetting::query()->updateOrCreate(
            ['key' => 'listing.placement.registered_price_cents'],
            ['value' => ['cents' => 2000], 'group' => 'billing'],
        );

        SystemSetting::query()->updateOrCreate(
            ['key' => 'listing.placement.guest_price_cents'],
            ['value' => ['cents' => 3000], 'group' => 'billing'],
        );

        SystemSetting::query()->updateOrCreate(
            ['key' => 'listing.placement.subscriber_default_price_cents'],
            ['value' => ['cents' => null], 'group' => 'billing'],
        );

        SystemSetting::query()->updateOrCreate(
            ['key' => 'branding.logo'],
            ['value' => ['header_media_uuid' => null, 'footer_media_uuid' => null, 'header_size' => 48, 'footer_size' => 36], 'group' => 'design'],
        );
    }

    public function down(): void
    {
        Schema::table('delivery_methods', function (Blueprint $table): void {
            $table->dropColumn(['code', 'is_integrated']);
        });

        SystemSetting::query()->whereIn('key', [
            'listing.placement.registered_price_cents',
            'listing.placement.guest_price_cents',
            'listing.placement.subscriber_default_price_cents',
            'branding.logo',
        ])->delete();
    }
};
