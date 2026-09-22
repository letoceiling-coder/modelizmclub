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

        /*
         * Две колонки — два отдельных обновления, каждое со своим условием.
         *
         * Одно на обе затирало бы измеренное: строка, попавшая в выборку
         * только из-за пустого веса, теряла бы настоящие габариты и получала
         * взамен пресет.
         */
        foreach (self::PRESETS as $key => $row) {
            DB::table('listings')
                ->where('package_size', $key)
                ->where(fn ($q) => $q->whereNull('dimensions_cm')
                    ->orWhereRaw("dimensions_cm->>'length' is null")
                    ->orWhereRaw("(dimensions_cm->>'length')::int <= 0"))
                ->update(['dimensions_cm' => json_encode([
                    'length' => $row['length'],
                    'width' => $row['width'],
                    'height' => $row['height'],
                ])]);

            DB::table('listings')
                ->where('package_size', $key)
                ->where(fn ($q) => $q->whereNull('weight_kg')->orWhere('weight_kg', '<=', 0))
                ->update(['weight_kg' => $row['weight']]);
        }

        /*
         * Остаются объявления со СДЭК, у которых нет ни габаритов, ни
         * типоразмера: колонки габаритов появились 25.08, и всё, что заведено
         * до этого, живёт с тремя пустыми полями; демо-строки — тоже.
         *
         * Их миграция намеренно не трогает. Подставить им «типичную коробку»
         * значило бы завести ту самую придуманную посылку, ради избавления от
         * которой всё и делается, а снять СДЭК — молча переписать предложение
         * продавца. Вместо этого расчёт доставки по такому объявлению
         * отказывается считать и называет причину
         * (`SafeDealService`, `ParcelSize::measured`), а продавец дозаполняет
         * габариты правкой — форма теперь их требует.
         */
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
         * осмысленное нельзя: у строк с типоразмером габариты после `up()`
         * равны его значениям, а у остальных типоразмера и не было.
         */
        Schema::table('listings', function (Blueprint $table): void {
            $table->string('package_size', 8)->nullable()->after('delivery_methods');
        });
    }
};
