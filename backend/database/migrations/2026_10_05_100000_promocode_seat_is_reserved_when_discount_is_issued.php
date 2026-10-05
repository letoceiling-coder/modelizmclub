<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Место промокода занимается при выдаче скидки. Решение владельца от 04.10.
 *
 * Как было. `findValid` проверяет лимит в момент, когда человеку называют
 * цену со скидкой, а строка использования пишется только после оплаты.
 * Между этими двумя моментами счётчик не растёт, и сколько угодно человек
 * одновременно проходят проверку на последнее место. Гонка воспроизведена
 * в ночном прогоне 04.10.
 *
 * Как стало. Та же таблица `promocode_usages` хранит два состояния:
 * `reserved` — место занято, оплаты ещё нет; `used` — оплата прошла.
 * Лимит считает оба. Бронь снимается при отмене или неуспехе платежа, а
 * брошенная — через тридцать минут, командой `promocodes:release-seats`.
 *
 * Почему не отдельная таблица брони: тогда лимит пришлось бы считать в двух
 * местах и складывать, и первое же расхождение между ними стало бы дырой —
 * ровно той, которую эта правка закрывает.
 *
 * `used_at` становится необязательным: у брони его нет по определению, и
 * ставить туда время выдачи значило бы называть бронь использованием.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promocode_usages', function (Blueprint $table): void {
            $table->string('status', 16)->default('used')->after('payment_id');
            $table->timestamp('reserved_at')->nullable()->after('status');
            $table->timestamp('used_at')->nullable()->change();

            // Лимит считается выборкой «по коду и состоянию» на каждой выдаче
            // скидки, и под неё нужен индекс: без него это чтение всей
            // таблицы использований на каждый ввод промокода.
            $table->index(['promocode_id', 'status'], 'promocode_usages_promocode_id_status_index');
            // Сторож брошенной брони ходит по времени.
            $table->index(['status', 'reserved_at'], 'promocode_usages_status_reserved_at_index');
        });

        // Всё, что записано до этой правки, — состоявшиеся использования.
        DB::table('promocode_usages')->update(['status' => 'used']);
    }

    public function down(): void
    {
        // Брони — не использования: при откате они не должны остаться
        // занимать места, поэтому снимаются, а не превращаются в `used`.
        DB::table('promocode_usages')->where('status', 'reserved')->delete();

        Schema::table('promocode_usages', function (Blueprint $table): void {
            $table->dropIndex('promocode_usages_promocode_id_status_index');
            $table->dropIndex('promocode_usages_status_reserved_at_index');
            $table->dropColumn(['status', 'reserved_at']);
        });
    }
};
