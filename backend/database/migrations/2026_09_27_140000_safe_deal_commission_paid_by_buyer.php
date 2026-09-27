<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Пять величин сделки — каждая своей колонкой, и отметка, кто платил комиссию.
 *
 * ЧТО БЫЛО. В `safe_deals` четыре денежные колонки: `amount_kopecks` (итог
 * покупателя), `platform_fee_kopecks`, `seller_payout_kopecks`,
 * `delivery_cost_kopecks`. Цена товара колонкой не была — она лежала в
 * `metadata.item_kopecks`, то есть в JSON. Бухгалтерия её оттуда не сложит и
 * не отберёт по ней строки, а в выгрузке она восстанавливалась вычитанием.
 *
 * ЧТО ДОБАВЛЯЕТСЯ.
 *
 *   `item_kopecks`  стоимость товара — переносится из `metadata`
 *   `fee_payer`     кто платил комиссию: `seller` (старая схема) | `buyer`
 *
 * ПЕРЕНОС ЦЕНЫ ТОВАРА. Основной источник — `metadata->>'item_kopecks'`; он
 * есть у всех сделок, созданных через `SafeDealService::create`. Для строк,
 * где его нет (ручные правки, ранние демо-данные), цена восстанавливается как
 * `amount − delivery`: в старой схеме итог покупателя складывался ровно из
 * товара и доставки. Оба пути дают величину, а не догадку, поэтому колонка
 * объявляется `NOT NULL` — пустой она не остаётся ни у одной строки.
 *
 * СТАРЫЕ СДЕЛКИ НЕ ПЕРЕСЧИТЫВАЮТСЯ. Прямое требование заказчика: у них
 * `fee_payer = 'seller'`, и `amount`, `platform_fee`, `seller_payout` остаются
 * как есть. Ни одна сумма ни в одной существующей строке этой миграцией не
 * меняется — переносится только то, что уже было записано в JSON.
 *
 * Почему различаем колонкой, а не датой или пустотой новых полей — в
 * `App\Enums\SafeDealFeePayer`.
 *
 * ОТКАТ. `down()` убирает обе колонки. Цена товара при этом не теряется:
 * `metadata.item_kopecks` миграция не трогает, и после откатa она остаётся
 * единственным источником — тем же, каким была до 27.09.
 */
return new class extends Migration
{
    public function up(): void
    {
        /*
         * Добавление колонок с проверкой: миграция должна пережить повторный
         * запуск на половине сделанной работы — и тест переноса проигрывает
         * её заново на существующей таблице.
         */
        Schema::table('safe_deals', function (Blueprint $table): void {
            if (! Schema::hasColumn('safe_deals', 'item_kopecks')) {
                $table->bigInteger('item_kopecks')->nullable()->after('seller_id');
            }
            if (! Schema::hasColumn('safe_deals', 'fee_payer')) {
                $table->string('fee_payer', 12)->default('seller')->after('platform_fee_kopecks');
            }
        });

        /*
         * Перенос по всей таблице одним запросом, а не обходом строк: сделок
         * на проде порядка полусотни, но миграция обязана пережить и рост.
         * `nullif` отсекает пустую строку, которую JSON отдаёт вместо NULL,
         * если ключа нет.
         */
        DB::statement(<<<'SQL'
            update safe_deals
               set item_kopecks = coalesce(
                     nullif(metadata->>'item_kopecks', '')::bigint,
                     amount_kopecks - coalesce(delivery_cost_kopecks, 0)
                   )
             where item_kopecks is null
        SQL);

        DB::statement('alter table safe_deals alter column item_kopecks set not null');
    }

    public function down(): void
    {
        Schema::table('safe_deals', function (Blueprint $table): void {
            $table->dropColumn(['item_kopecks', 'fee_payer']);
        });
    }
};
