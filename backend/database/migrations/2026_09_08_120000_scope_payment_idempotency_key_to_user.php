<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ключ идемпотентности уникален в пределах пользователя, а не всей таблицы.
 *
 * `PaymentRecorder::createPending` ищет прошлый платёж по паре
 * «ключ + пользователь», а индекс стоял на одном ключе. Область уникальности
 * и область поиска расходились, и на стыке получался отказ, который никто не
 * ловил: если бы ключ совпал у двух разных людей, поиск у второго ничего не
 * нашёл бы, вставка упёрлась бы в чужую строку, и человек получил бы 500 на
 * кнопке «Оплатить».
 *
 * Ключ выдаёт браузер (`crypto.randomUUID`), поэтому совпадение практически
 * недостижимо — дефект найден тестом, а не жалобой. Но чинится он одной
 * строкой, а разошедшиеся инварианты в денежной таблице рано или поздно
 * встречаются: достаточно, чтобы ключ однажды начали строить не из случайных
 * чисел, а, скажем, из суммы и времени.
 *
 * Существующие данные переносятся как есть: глобальная уникальность строже
 * пользовательской, поэтому всё, что прошло старый индекс, проходит и новый.
 * Обратная миграция такой гарантии не даёт — см. down().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropUnique('payments_idempotency_key_unique');
            $table->unique(['user_id', 'idempotency_key'], 'payments_user_id_idempotency_key_unique');
        });
    }

    public function down(): void
    {
        /*
         * Откат возможен не всегда, и молча ронять его на середине нельзя.
         *
         * Пока действует пользовательская уникальность, два человека могут
         * получить один ключ — и тогда глобальный индекс уже не построится.
         * Проверяем заранее и говорим прямо, вместо того чтобы оставить
         * таблицу без уникального индекса вовсе: в откате это опаснее, чем
         * несостоявшийся откат.
         */
        $duplicates = DB::table('payments')
            ->whereNotNull('idempotency_key')
            ->select('idempotency_key')
            ->groupBy('idempotency_key')
            ->havingRaw('count(*) > 1')
            ->count();

        if ($duplicates > 0) {
            throw new RuntimeException(
                "Откат невозможен: {$duplicates} ключ(ей) идемпотентности встречаются у разных ".
                'пользователей. Глобальный уникальный индекс на них не построится.',
            );
        }

        Schema::table('payments', function (Blueprint $table): void {
            $table->dropUnique('payments_user_id_idempotency_key_unique');
            $table->unique('idempotency_key', 'payments_idempotency_key_unique');
        });
    }
};
