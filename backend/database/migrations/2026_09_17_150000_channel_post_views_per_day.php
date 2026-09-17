<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Просмотр записи канала — один на читателя в сутки, а не один навсегда.
 *
 * Разбор 17.09: книга channel_post_views была уникальной по паре
 * (запись, читатель), и повторный заход того же человека через неделю не
 * значил ничего. Заказчик: «один раз в сутки на человека; повторные заходы
 * не накручивают». День — по часам приложения (Europe/Moscow), в том же
 * стенном времени, что и created_at: существующие строки получают день из
 * него.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('channel_post_views', function (Blueprint $table): void {
            $table->date('viewed_on')->nullable();
        });

        DB::table('channel_post_views')->update([
            'viewed_on' => DB::raw('coalesce(created_at, now())::date'),
        ]);

        Schema::table('channel_post_views', function (Blueprint $table): void {
            $table->date('viewed_on')->nullable(false)->change();
            $table->dropUnique(['channel_post_id', 'viewer_key']);
            $table->unique(['channel_post_id', 'viewer_key', 'viewed_on']);
        });
    }

    public function down(): void
    {
        // Повторные дни одного читателя старой уникальности не пройдут —
        // остаётся самая ранняя строка. Счётчики после отката выровнять
        // командой counters:resync.
        DB::statement('delete from channel_post_views v using channel_post_views w where v.channel_post_id = w.channel_post_id and v.viewer_key = w.viewer_key and v.id > w.id');

        Schema::table('channel_post_views', function (Blueprint $table): void {
            $table->dropUnique(['channel_post_id', 'viewer_key', 'viewed_on']);
            $table->unique(['channel_post_id', 'viewer_key']);
            $table->dropColumn('viewed_on');
        });
    }
};
