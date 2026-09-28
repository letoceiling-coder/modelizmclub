<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Период акции и круг тех, кому она доступна. И то же — у промокодов.
 *
 * 1. ПЕРИОД. У акции был только `expires_at` — конец. Начала не было вовсе:
 *    акцию нельзя было завести заранее, она начинала раздавать места в тот
 *    же миг, как её сохранили. `starts_at` закрывает это, и вместе с концом
 *    даёт четыре состояния: запланирована, активна, завершена, на паузе.
 *
 * 2. КОМУ ДОСТУПНА. Было одно «да/нет» — `auto_assign_on_register`. Теперь
 *    круг называется словом:
 *
 *      all       любому, кто дошёл до выдачи (регистрация, подтверждение
 *                телефона, вход через OAuth или MAX) — это нынешнее поведение;
 *      new       только тем, кто зарегистрировался после начала акции;
 *      selected  только перечисленным поимённо.
 *
 *    Существующим акциям ставится `all`: именно так они и работают сегодня,
 *    и менять поведение выкаткой нельзя. Флаг `auto_assign_on_register`
 *    остаётся выключателем автоматической выдачи — он отвечает на другой
 *    вопрос («раздаём ли вообще»), и складывать их в одно поле значило бы
 *    потерять возможность приостановить раздачу, не трогая круг.
 *
 * 3. ПРОМОКОДЫ. Здесь нашлось расхождение, из-за которого правка вышла
 *    больше просьбы. В админке поле «ID пользователей через запятую» лежит
 *    в блоке уведомлений: `notify_user_ids` решает, **кому придёт
 *    оповещение** о промокоде, и ни на что больше не влияет.
 *
 *    Ограничение доступа в коде тоже есть, но однобокое: колонка
 *    `promocodes.user_id` привязывает код ровно к одному человеку
 *    (`PromocodeService::assertValid`), и в админке её не видно.
 *
 *    Просили подпись «Кому доступен промокод» с обещанием «применить
 *    смогут только они». Переименовать поле уведомлений значило бы написать
 *    неправду: подпись обещала бы запрет, которого нет. Поэтому заводится
 *    настоящее ограничение на нескольких людей — `promocode_users`, — и
 *    проверка при применении начинает его спрашивать. Поле уведомлений
 *    остаётся собой, под своей подписью.
 *
 * ОТКАТ убирает колонки и обе таблицы связей. Ограничение доступа при этом
 * пропадает — про это сказано вслух, потому что после отката промокод,
 * выданный десятерым, снова станет доступен всем.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promo_pools', function (Blueprint $table): void {
            if (! Schema::hasColumn('promo_pools', 'starts_at')) {
                $table->timestampTz('starts_at')->nullable()->after('current_activations');
            }
            if (! Schema::hasColumn('promo_pools', 'audience')) {
                $table->string('audience', 16)->default('all')->after('auto_assign_on_register');
            }
        });

        Schema::create('promo_pool_users', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('promo_pool_id')->constrained('promo_pools')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->unique(['promo_pool_id', 'user_id']);
        });

        Schema::create('promocode_users', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('promocode_id')->constrained('promocodes')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->unique(['promocode_id', 'user_id']);
        });

        /*
         * Прежняя привязка к одному человеку переезжает в связь.
         *
         * Колонка `user_id` остаётся и продолжает работать — её читает
         * `assertValid`, и обрывать это на выкатке незачем. Но чтобы админка
         * показывала один круг, а не два, существующие привязки дублируются
         * в новую таблицу. Дубль безвреден: обе проверки говорят одно и то
         * же про одного и того же человека.
         */
        $привязанные = DB::table('promocodes')->whereNotNull('user_id')->get(['id', 'user_id']);
        foreach ($привязанные as $строка) {
            DB::table('promocode_users')->insertOrIgnore([
                'promocode_id' => $строка->id,
                'user_id' => $строка->user_id,
                'created_at' => now(),
            ]);
        }

        if ($привязанные->isNotEmpty()) {
            echo '  промокоды: перенесено привязок к людям — '.$привязанные->count()."\n";
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('promocode_users');
        Schema::dropIfExists('promo_pool_users');

        Schema::table('promo_pools', function (Blueprint $table): void {
            foreach (['starts_at', 'audience'] as $колонка) {
                if (Schema::hasColumn('promo_pools', $колонка)) {
                    $table->dropColumn($колонка);
                }
            }
        });

        echo "  промокоды: откат убрал ограничение по кругу людей — коды снова доступны всем\n";
    }
};
