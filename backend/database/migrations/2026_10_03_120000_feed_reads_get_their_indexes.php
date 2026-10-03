<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Индексы под запросы, которые лента делает на каждую страницу.
 *
 * ЧТО БЫЛО. У `post_reposts` единственный индекс — первичный ключ по `id`.
 * Проверено на боевой базе 03.10 с `enable_seqscan = off`: планировщик всё
 * равно идёт последовательно, со штрафом 10^10, то есть пригодного индекса
 * нет вовсе.
 *
 *     explain select original_post_id, count(*) from post_reposts
 *       where original_post_id in (1,2,3) group by original_post_id;
 *
 *     GroupAggregate  (cost=10000000001.22..10000000001.27 …)
 *       ->  Sort
 *             ->  Seq Scan on post_reposts
 *
 * Кто по нему ходит, и как часто:
 *
 * | Место | Запрос | Когда |
 * | --- | --- | --- |
 * | `PostService:564` | `original_post_id in (…)` + `group by` | на каждую страницу ленты |
 * | `PostService:601` | `user_id = ?` и `original_post_id in (…)` | там же, флаги читателя |
 * | `PostService:174` | `repost_post_id = ?` | на каждое удаление записи |
 *
 * Тремя индексами, а не одним: у трёх запросов разные ведущие колонки, и
 * составной по `(user_id, original_post_id)` не обслуживает первый, где
 * `user_id` в условии нет. Цена записи здесь мала — репост редкое действие,
 * а чтение идёт на каждом открытии ленты.
 *
 * `channel_posts.feed_post_id` — та же история, но на другом пути.
 * `PostService::recordView` зовёт `ChannelPost::where('feed_post_id', …)`
 * при **каждом** просмотре записи (`POST /posts/{uuid}/view`), и индекса на
 * этой колонке нет: у таблицы есть `(channel_id, pinned_at)` и
 * `(channel_id, status)`, а по зеркалу поиск шёл перебором.
 *
 * ПОЧЕМУ НЕ УНИКАЛЬНЫЕ. На боевой базе дублей нет ни у
 * `post_reposts.repost_post_id`, ни у пары `(user_id, original_post_id)`, ни
 * у `channel_posts.feed_post_id` — проверено. Соблазн объявить их
 * уникальными есть, но это уже не ускорение, а новое ограничение: код
 * удаляет запись репоста по `repost_post_id` и заводит заново, и гонка на
 * повторном репосте превратилась бы из ничего в 500. Ускорение и ограничение
 * — два разных решения; здесь только первое.
 *
 * РАЗМЕРЫ НА 03.10. `post_reposts` 21 строка, `channel_posts` 53. То есть
 * сегодня разницы не видно, и это осознанно: индекс ставится до того, как
 * таблица станет большой, а не после. На 59 пользователях любой план дешёв —
 * мерить выигрыш надо будет на объёмах.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_reposts', function (Blueprint $table): void {
            $table->index('original_post_id', 'post_reposts_original_post_id_index');
            $table->index(['user_id', 'original_post_id'], 'post_reposts_user_id_original_post_id_index');
            $table->index('repost_post_id', 'post_reposts_repost_post_id_index');
        });

        Schema::table('channel_posts', function (Blueprint $table): void {
            $table->index('feed_post_id', 'channel_posts_feed_post_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('post_reposts', function (Blueprint $table): void {
            $table->dropIndex('post_reposts_original_post_id_index');
            $table->dropIndex('post_reposts_user_id_original_post_id_index');
            $table->dropIndex('post_reposts_repost_post_id_index');
        });

        Schema::table('channel_posts', function (Blueprint $table): void {
            $table->dropIndex('channel_posts_feed_post_id_index');
        });
    }
};
