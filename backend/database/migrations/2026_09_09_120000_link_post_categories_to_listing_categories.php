<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Связь направления с категорией объявлений.
 *
 * Деревья два и они разные: 41 направление против 25 категорий объявлений,
 * пересечение по slug — двенадцать. Совпадают там, где речь о предмете
 * («Авиация», «Танки», «Планеры»), расходятся там, где направление про
 * разговор, а не про торговлю: «Мастерская», «Обзоры наборов», «Выставки и
 * события», «Каналы».
 *
 * Поэтому не миграция данных в одно дерево, а явная ссылка. Пусто — значит
 * у направления нет своей полки в каталоге, и вкладка «Объявления» на его
 * странице не показывается. Заполняется автоматически по совпадению slug
 * (см. categories:link-listing) и вручную из админки там, где slug разошлись.
 *
 * nullOnDelete: удаление категории объявлений не должно уносить направление.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('post_categories', function (Blueprint $table): void {
            $table->foreignId('listing_category_id')
                ->nullable()
                ->after('parent_id')
                ->constrained('listing_categories')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('post_categories', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('listing_category_id');
        });
    }
};
