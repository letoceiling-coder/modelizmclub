<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Настройки надбавки к доставке.
 *
 * Строки заводятся миграцией, а не «появятся при первом сохранении»: раздел
 * настроек в админке показывает то, что есть в базе, и без этих строк
 * владелец не увидел бы саму возможность — настройку, которой нет на экране,
 * нельзя ни включить, ни узнать, что она существует.
 *
 * Значения по умолчанию — выключено и нули: выкатка не меняет ни одной цены.
 */
return new class extends Migration
{
    private const ROWS = [
        ['key' => 'delivery.markup.enabled', 'value' => ['enabled' => false]],
        ['key' => 'delivery.markup.percent', 'value' => ['percent' => 0]],
        ['key' => 'delivery.markup.fixed_cents', 'value' => ['fixed_cents' => 0]],
    ];

    public function up(): void
    {
        foreach (self::ROWS as $row) {
            // `insertOrIgnore`, а не `updateOrInsert`: повторный прогон не
            // должен сбрасывать настройку, которую владелец уже задал.
            DB::table('system_settings')->insertOrIgnore([
                'key' => $row['key'],
                'value' => json_encode($row['value']),
                'group' => 'delivery',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->whereIn('key', array_column(self::ROWS, 'key'))
            ->delete();
    }
};
