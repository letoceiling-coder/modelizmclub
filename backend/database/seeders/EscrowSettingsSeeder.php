<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class EscrowSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['key' => 'escrow.fee.enabled', 'value' => ['enabled' => true], 'group' => 'escrow'],
            ['key' => 'escrow.fee.percent', 'value' => ['percent' => 5.0], 'group' => 'escrow'],
            ['key' => 'escrow.fee.flat_threshold_cents', 'value' => ['threshold_cents' => 100_000], 'group' => 'escrow'],
            ['key' => 'escrow.fee.flat_amount_cents', 'value' => ['amount_cents' => 30_000], 'group' => 'escrow'],
            ['key' => 'escrow.fee.min_cents', 'value' => ['min_cents' => 30_000], 'group' => 'escrow'],
            ['key' => 'escrow.fee.max_cents', 'value' => ['max_cents' => null], 'group' => 'escrow'],
            ['key' => 'escrow.fee.apply_to', 'value' => ['base' => 'item'], 'group' => 'escrow'],
            ['key' => 'escrow.release.mode', 'value' => ['mode' => 'buyer_confirm'], 'group' => 'escrow'],
            ['key' => 'escrow.release.auto_release_days', 'value' => ['days' => 7], 'group' => 'escrow'],
            ['key' => 'escrow.release.seller_ship_deadline_days', 'value' => ['days' => 5], 'group' => 'escrow'],
            ['key' => 'escrow.dispute.window_days', 'value' => ['days' => 14], 'group' => 'escrow'],
        ];

        foreach ($rows as $row) {
            SystemSetting::query()->updateOrCreate(
                ['key' => $row['key']],
                ['value' => $row['value'], 'group' => $row['group']],
            );
        }
    }
}
