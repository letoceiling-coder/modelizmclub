<?php

use App\Models\SystemSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $row = SystemSetting::query()->where('key', 'listing.placement.subscriber_default_price_cents')->first();
        $cents = is_array($row?->value) ? ($row->value['cents'] ?? null) : null;

        if ($cents === null) {
            SystemSetting::query()->updateOrCreate(
                ['key' => 'listing.placement.subscriber_default_price_cents'],
                ['value' => ['cents' => 2000], 'group' => 'billing'],
            );
        }
    }

    public function down(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'listing.placement.subscriber_default_price_cents'],
            ['value' => ['cents' => null], 'group' => 'billing'],
        );
    }
};
