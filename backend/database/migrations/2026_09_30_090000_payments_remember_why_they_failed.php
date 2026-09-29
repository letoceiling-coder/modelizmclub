<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Платёж запоминает, почему не состоялся.
 *
 * ЧТО БЫЛО. У каждого отказа в `metadata.failure_reason` лежала фраза,
 * которую написали мы сами. На 30.09 в боевой базе 54 настоящих отказа, и
 * у **всех** она одна и та же: «Сверка: банк сообщил об отмене заказа».
 * Разборчивые причины (`insufficient_funds`, `declined`) есть только у
 * заглушки, то есть у тестовых платежей.
 *
 * Отличить «человек закрыл форму» от «банк отказал» по этой строке
 * нельзя. А воронка, построенная на таких данных, будет говорить, что
 * банк отклоняет всё подряд.
 *
 * ЧТО ОТВЕЧАЕТ БАНК И ЧТО МЫ ВЫБРАСЫВАЕМ. `getOrderStatusExtended`
 * возвращает `orderStatus` (его читаем) и `actionCode` с
 * `actionCodeDescription` — код и текст самого банка (их не читаем нигде:
 * поиск по корню слова по всему `backend/app` давал ноль вхождений).
 * Именно `actionCode` различает «истёк срок заказа» и «недостаточно
 * средств»; `orderStatus 6` покрывает оба.
 *
 * ПОЧЕМУ КОЛОНКИ, А НЕ METADATA. По этим полям строится воронка: отбор по
 * периоду и группировка по причине. В jsonb это возможно, но индекс и
 * читаемость запроса теряются, а сводку по деньгам мы за последние дни
 * чинили трижды — лишней неясности в ней быть не должно.
 *
 * ОТДЕЛЬНЫЙ СТАТУС ДЛЯ БРОШЕННОЙ ФОРМЫ. `abandoned` — это не отказ.
 * Сваливать его в `failed` значит утверждать, что банк отклонил платёж,
 * которого банк не видел. В воронке это разные шаги.
 *
 * `updated_at` НЕ ГОДИТСЯ КАК ВРЕМЯ ОТКАЗА. Проверено на боевых данных:
 * у пяти платежей августа `updated_at` стоит 08.09 11:59 — это один
 * прогон сверки закрыл их все разом, спустя три недели. У остальных
 * двадцати двух разница 14–25 минут, и это тоже не человек, а расписание
 * сторожа. Поэтому `failed_at` пишется отдельно и вместе с ним `decided_by`
 * — кто вынес решение: колбэк банка, сверка или сам человек.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            // Код и текст провайдера — как он их прислал, без пересказа.
            $table->string('failure_code', 64)->nullable()->after('status');
            $table->string('failure_message', 500)->nullable()->after('failure_code');
            /*
             * Где оборвалось: `created` — заказ завели, до формы не дошли;
             * `form` — форму открыли, платить не стали; `bank` — банк
             * ответил отказом; `unknown` — узнать не удалось.
             */
            $table->string('failure_stage', 16)->nullable()->after('failure_message');
            $table->timestamp('failed_at')->nullable()->after('failure_stage');
            // Когда человек ушёл на форму банка. Без этого «дошло до формы»
            // в воронке пришлось бы выдумывать.
            $table->timestamp('form_opened_at')->nullable()->after('failed_at');
            // callback | reconcile | user
            $table->string('decided_by', 16)->nullable()->after('form_opened_at');

            $table->index(['status', 'created_at'], 'payments_status_created_idx');
            $table->index('failure_code', 'payments_failure_code_idx');
        });

        /*
         * Прошлым отказам код не выдумываем.
         *
         * Единственное, что про них известно достоверно, — фраза сверки, и
         * она уже лежит в metadata. Проставить им `failure_stage = 'bank'`
         * значило бы утверждать то, чего мы не знаем: `orderStatus 6`
         * покрывает и отказ карты, и истёкший неоплаченный заказ.
         *
         * Что перенести можно честно — момент решения: у этих строк отказ
         * вынесла сверка, и `updated_at` это её прогон.
         */
        DB::table('payments')
            ->where('status', 'failed')
            ->whereNull('failed_at')
            ->update([
                'failed_at' => DB::raw('updated_at'),
                'decided_by' => DB::raw("case when metadata::jsonb->>'failure_reason' like 'Сверка:%' then 'reconcile' else null end"),
                'failure_stage' => 'unknown',
            ]);

        $перенесено = DB::table('payments')->where('failure_stage', 'unknown')->count();
        echo "  платежи: у {$перенесено} прошлых отказов проставлено «причина неизвестна» — придумывать её задним числом нечем\n";
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropIndex('payments_status_created_idx');
            $table->dropIndex('payments_failure_code_idx');
            $table->dropColumn([
                'failure_code', 'failure_message', 'failure_stage',
                'failed_at', 'form_opened_at', 'decided_by',
            ]);
        });
    }
};
