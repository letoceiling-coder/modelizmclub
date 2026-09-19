<?php

use App\Models\PostCategory;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CategoryTaxonomyService;

/**
 * Направление «Нумизматика» (решение 19.09).
 *
 * Отдельное направление верхнего уровня, рядом с авиацией и бронетехникой:
 * монеты не ложатся ни в одну из существующих веток. Подкатегорий нет — их
 * назовёт тот, кто будет вести направление. Создаётся тем же путём, что и
 * из админки (CategoryTaxonomyService), чтобы появились зеркала в каталоге
 * объявлений и в сообществах. Если направление с таким адресом уже есть
 * (завели руками), миграция его не трогает.
 *
 * Направление добавляется в существующее дерево. Пустое дерево — свежая
 * установка, его заполнит ReferenceDataSeeder, где «Нумизматика» тоже
 * есть; миграция в пустую базу ничего не кладёт, иначе дерево тестов и
 * первой установки начиналось бы с одной нумизматики.
 */
return new class extends Migration
{
    private const SLUG = 'numismatics';

    public function up(): void
    {
        $treeExists = PostCategory::query()->whereNull('parent_id')->exists();
        if (! $treeExists || PostCategory::query()->where('slug', self::SLUG)->exists()) {
            return;
        }

        // Рядом с бронетехникой: сразу за ней в порядке меню.
        $armorOrder = DB::table('post_categories')->where('slug', 'armor')->value('sort_order');
        $sortOrder = $armorOrder !== null
            ? (int) $armorOrder + 1
            : (int) DB::table('post_categories')->whereNull('parent_id')->max('sort_order') + 1;

        $category = PostCategory::query()->create([
            'parent_id' => null,
            'name' => 'Нумизматика',
            'slug' => self::SLUG,
            'icon' => 'coins',
            'sort_order' => $sortOrder,
            'is_active' => true,
            'in_feed' => true,
            'in_listings' => true,
            'in_communities' => true,
        ]);

        app(CategoryTaxonomyService::class)->syncFromPostCategory($category);
    }

    public function down(): void
    {
        // Направление не удаляется: в нём могут быть записи и объявления.
    }
};
