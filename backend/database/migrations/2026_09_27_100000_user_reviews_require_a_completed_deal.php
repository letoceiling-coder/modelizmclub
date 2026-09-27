<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\User\Services\UserRatingService;

/**
 * Отзыв без сделки становится невозможным на уровне базы, а два оставшихся
 * с прода убираются.
 *
 * ЧТО НАШЛА ПРИЁМКА 27.09. В `user_reviews` четыре строки, и две из них
 * (id 1 и 2) не привязаны ни к какой сделке: обе от учётки 1229 о 1230,
 * обе с оценкой 5. Они наследство, заведённое до правила 17.09 «оценивает
 * покупатель продавца по завершённой сделке».
 *
 * ПОЧЕМУ ИХ ДВЕ, А НЕ ОДНА. Защита от повтора — уникальный индекс по паре
 * (`safe_deal_id`, `author_id`). В Postgres два NULL не равны друг другу,
 * поэтому пара с пустой сделкой не повторяется формально, и один и тот же
 * автор может положить сколько угодно строк об одном и том же человеке.
 * То есть дело не только в двух строках: пока колонка допускает NULL,
 * индекс на этих строках не работает вовсе.
 *
 * ПОЧЕМУ БАЗОЙ, А НЕ ПРОВЕРКОЙ В КОДЕ. Проверки уже стоят в трёх местах:
 * политика (`SafeDealPolicy::review`), сервис (`SafeDealService::review`)
 * и сама модель (`UserReview::booted`). Через API такую строку не завести
 * — приёмка это подтвердила, отзыв по несуществующей сделке отбивается
 * 404. Но `creating` у модели не срабатывает на `DB::table()->insert()`,
 * и мимо него ходят сидеры, команды и ручные правки — тем же путём, каким
 * появились эти две. `NOT NULL` закрывает и его.
 *
 * ЧТО С РЕЙТИНГОМ. Чтения эти строки уже не показывают:
 * `UserRatingService::completedDealReviews()` требует связанную завершённую
 * сделку. Но денормализованный счётчик `user_profiles.reviews_count`
 * заполнялся до правила и с тех пор не пересчитывался — у 1230 в профиле
 * стоит 3 отзыва при одном настоящем. Пересчёт здесь же, и только для
 * задетых: `sync()` обходит всю историю пользователя, звать его на всех
 * незачем.
 *
 * ОТКАТ. `down()` возвращает колонке NULL и прежнее поведение внешнего
 * ключа, но **удалённые строки не воссоздаёт** — восстанавливать отзывы,
 * не стоящие ни на одной сделке, незачем, а счётчик после отката сойдётся
 * с тем, что видно в списке.
 */
return new class extends Migration
{
    public function up(): void
    {
        $задетые = DB::table('user_reviews')
            ->whereNull('safe_deal_id')
            ->distinct()
            ->pluck('target_user_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        DB::table('user_reviews')->whereNull('safe_deal_id')->delete();

        /*
         * Внешний ключ стоял на `null on delete`: удаление сделки обнуляло
         * ссылку. С `NOT NULL` это стало бы отказом базы посреди удаления,
         * поэтому поведение меняется на каскад — отзыв живёт ровно столько,
         * сколько сделка, по которой он оставлен.
         */
        Schema::table('user_reviews', function (Blueprint $table): void {
            $table->dropForeign(['safe_deal_id']);
        });

        DB::statement('alter table user_reviews alter column safe_deal_id set not null');

        Schema::table('user_reviews', function (Blueprint $table): void {
            $table->foreign('safe_deal_id')->references('id')->on('safe_deals')->cascadeOnDelete();
        });

        $рейтинги = app(UserRatingService::class);
        foreach ($задетые as $userId) {
            $рейтинги->sync($userId);
        }
    }

    public function down(): void
    {
        Schema::table('user_reviews', function (Blueprint $table): void {
            $table->dropForeign(['safe_deal_id']);
        });

        DB::statement('alter table user_reviews alter column safe_deal_id drop not null');

        Schema::table('user_reviews', function (Blueprint $table): void {
            $table->foreign('safe_deal_id')->references('id')->on('safe_deals')->nullOnDelete();
        });
    }
};
