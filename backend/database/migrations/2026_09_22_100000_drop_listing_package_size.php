<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Типоразмеры S/M/L убраны: габариты посылки обязательны.
 *
 * До этого типоразмер заменял габариты, и тариф считался по придуманной
 * коробке. Объявления, у которых габариты так и не заполнены, донаполняются
 * из того самого пресета — не потому, что он верен, а потому, что это
 * единственное, что о них известно: обнулить значило бы сломать расчёт
 * доставки у живых объявлений, а спросить продавца миграция не может.
 *
 * Значения пресетов выписаны здесь числами намеренно. Брать их из
 * `ParcelSize::PRESETS` было бы нельзя: константа удалена этой же веткой, а
 * миграция обязана работать и через год, когда о ней никто не помнит.
 */
return new class extends Migration
{
    /** @var array<string, array{length: int, width: int, height: int, weight: float}> */
    private const PRESETS = [
        's' => ['length' => 20, 'width' => 15, 'height' => 10, 'weight' => 0.5],
        'm' => ['length' => 30, 'width' => 20, 'height' => 15, 'weight' => 2.0],
        'l' => ['length' => 40, 'width' => 30, 'height' => 25, 'weight' => 5.0],
    ];

    public function up(): void
    {
        if (! Schema::hasColumn('listings', 'package_size')) {
            return;
        }

        foreach (self::PRESETS as $key => $row) {
            DB::table('listings')
                ->where('package_size', $key)
                ->where(function ($q): void {
                    $q->whereNull('dimensions_cm')
                        ->orWhereNull('weight_kg')
                        ->orWhere('weight_kg', '<=', 0);
                })
                ->update([
                    'dimensions_cm' => json_encode([
                        'length' => $row['length'],
                        'width' => $row['width'],
                        'height' => $row['height'],
                    ]),
                    'weight_kg' => $row['weight'],
                ]);
        }

        Schema::table('listings', function (Blueprint $table): void {
            $table->dropColumn('package_size');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('listings', 'package_size')) {
            return;
        }

        /*
         * Колонка возвращается пустой. Восстановить в ней что-либо
         * осмысленное нельзя и не нужно: габариты после `up()` заданы у всех
         * строк, и именно они — источник правды для тарифа.
         */
        Schema::table('listings', function (Blueprint $table): void {
            $table->string('package_size', 8)->nullable()->after('delivery_methods');
        });
    }
};
