<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Четыре связочные таблицы имели только первичный ключ, а читались по
 * внешним. Postgres на них честно шёл полным перебором: idx_scan 0 при
 * 58 937 (listing_media), 136 687 (message_attachments) и 18 252
 * (post_media) последовательных чтениях.
 *
 * Сегодня это ничего не стоит — в таблицах по полсотни строк, и перебор
 * из одной страницы дешевле похода в индекс. План после этой миграции на
 * проде не изменится, и это не признак бесполезности: то же самое было с
 * personal_access_tokens, где миллион перебором оказался нормой для 143
 * строк. Индексы здесь ставятся не ради текущего плана, а ради того, что
 * произойдёт с ним при росте.
 *
 * Измерено на копии listing_media в миллион строк (локальный Postgres 16):
 *
 *   выборка медиа для 20 объявлений   37,19 мс → 1,35 мс   (×27)
 *   поиск по media_id                 76,17 мс → 0,36 мс   (×210)
 *
 * Второе число важнее первого: по media_id ходит не приложение, а каскад
 * внешнего ключа. Удаление одной строки media заставляет Postgres искать
 * ссылки в каждой дочерней таблице, и без индекса это полный перебор на
 * каждое удаление.
 *
 * Состав индексов выбран по реальным запросам, а не по списку колонок:
 *
 *   listing_media       Listing::mediaItems() — hasMany(...)->orderBy('sort_order'),
 *                       то есть where listing_id in (…) order by sort_order.
 *                       Составной (listing_id, sort_order) закрывает и выборку,
 *                       и сортировку, и удаление по listing_id в ListingService.
 *   post_media          то же самое у Post::mediaItems().
 *   message_attachments Message::attachments() без сортировки — хватает
 *                       одиночного (message_id).
 *   message_user_hides  первичный ключ (user_id, message_id) уже закрывает
 *                       всё, что спрашивает ChatService: там всегда обе
 *                       колонки равенством. Не закрыт только обратный ход —
 *                       каскад при удалении сообщения, ему нужен message_id
 *                       первой колонкой.
 *
 * Отдельный (media_id) в трёх таблицах — для того же каскада со стороны media.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listing_media', function (Blueprint $table): void {
            $table->index(['listing_id', 'sort_order'], 'listing_media_listing_id_sort_order_index');
            $table->index('media_id', 'listing_media_media_id_index');
        });

        Schema::table('post_media', function (Blueprint $table): void {
            $table->index(['post_id', 'sort_order'], 'post_media_post_id_sort_order_index');
            $table->index('media_id', 'post_media_media_id_index');
        });

        Schema::table('message_attachments', function (Blueprint $table): void {
            $table->index('message_id', 'message_attachments_message_id_index');
            $table->index('media_id', 'message_attachments_media_id_index');
        });

        Schema::table('message_user_hides', function (Blueprint $table): void {
            $table->index('message_id', 'message_user_hides_message_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('listing_media', function (Blueprint $table): void {
            $table->dropIndex('listing_media_listing_id_sort_order_index');
            $table->dropIndex('listing_media_media_id_index');
        });

        Schema::table('post_media', function (Blueprint $table): void {
            $table->dropIndex('post_media_post_id_sort_order_index');
            $table->dropIndex('post_media_media_id_index');
        });

        Schema::table('message_attachments', function (Blueprint $table): void {
            $table->dropIndex('message_attachments_message_id_index');
            $table->dropIndex('message_attachments_media_id_index');
        });

        Schema::table('message_user_hides', function (Blueprint $table): void {
            $table->dropIndex('message_user_hides_message_id_index');
        });
    }
};
