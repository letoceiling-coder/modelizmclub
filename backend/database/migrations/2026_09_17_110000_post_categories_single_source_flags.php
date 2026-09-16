<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Одно дерево категорий — post_categories. Где узел показывается, решают
 * флаги, а деревья объявлений и сообществ строятся из него.
 *
 * Разбор 17.09 на проде: форма подачи брала дерево записей (15 разделов
 * верхнего уровня), каталог и фильтр — дерево объявлений (20, из них в
 * фильтре 13), сообщества — своё (21). Совпадали по пути 76 узлов из 79/86,
 * а связь `listing_category_id` была заполнена у 12. Сводить таблицы в одну
 * значило бы перепривязать объявления, цены размещения и промокоды; вместо
 * этого таблицы остаются, но правятся только через дерево направлений.
 *
 * Флаги:
 *  - in_feed — лента, направления, комнаты, лендинг;
 *  - in_listings — форма подачи, каталог, фильтр каталога;
 *  - in_communities — сообщества.
 * Действуют вместе с предками: скрытый раздел скрывает и подразделы.
 *
 * `community_category_id` — такая же связь с деревом сообществ, как
 * `listing_category_id` с деревом объявлений. Данные — командой
 * `categories:single-source` (по умолчанию пробный прогон).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_categories', function (Blueprint $table): void {
            $table->boolean('in_feed')->default(true);
            $table->boolean('in_listings')->default(true);
            $table->boolean('in_communities')->default(true);
            $table->foreignId('community_category_id')->nullable()->constrained('community_categories')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('post_categories', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('community_category_id');
            $table->dropColumn(['in_feed', 'in_listings', 'in_communities']);
        });
    }
};
