<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CatalogService;

/**
 * Убирает из каталога объявлений две категории, оставшиеся от смоук-тестов
 * эскроу: `escrow-smoke` (11.08) и `escrow-e2e` (12.08).
 *
 * ПОЧЕМУ ЭТО НЕ ПРОСТО МУСОР. Обе `is_active = true`, то есть лежали в
 * дереве каталога наравне с настоящими разделами: два узла верхнего уровня
 * из двенадцати назывались «Escrow smoke» и «Escrow E2E». Их видел каждый,
 * кто открывал категории объявлений.
 *
 * ПРОВЕРЕНО ПЕРЕД УДАЛЕНИЕМ. Все шесть внешних ключей, которые смотрят на
 * `listing_categories`, посчитаны на боевой базе 11.09 — везде ноль:
 * объявлений по `category_id` и по `subcategory_id`, промокодов, правил
 * цен, дочерних категорий, связей из направлений. Удаление никого не
 * тянет за собой.
 *
 * ОТКАТА НЕТ НАРОЧНО. `down()` не восстанавливает эти строки: воссоздавать
 * мусор от тестов незачем, а откат миграции не должен возвращать в каталог
 * разделы с такими именами. Если понадобится — заводятся из админки.
 */
return new class extends Migration
{
    private const SLUGS = ['escrow-smoke', 'escrow-e2e'];

    public function up(): void
    {
        $ids = DB::table('listing_categories')->whereIn('slug', self::SLUGS)->pluck('id');

        if ($ids->isEmpty()) {
            return;
        }

        /*
         * Проверка перед записью, а не после: если на строку кто-то
         * сослался уже после разбора, удаление оборвёт связь молча —
         * внешние ключи здесь стоят на `set null`, а не на `restrict`.
         */
        $used = DB::table('listings')->whereIn('category_id', $ids)->count()
            + DB::table('listings')->whereIn('subcategory_id', $ids)->count()
            + DB::table('promocodes')->whereIn('listing_category_id', $ids)->count()
            + DB::table('listing_pricing_rules')->whereIn('category_id', $ids)->count()
            + DB::table('post_categories')->whereIn('listing_category_id', $ids)->count()
            + DB::table('listing_categories')->whereIn('parent_id', $ids)->count();

        if ($used > 0) {
            throw new RuntimeException(
                "На тестовые категории эскроу ссылаются {$used} записей — удаление отменено, разберитесь вручную."
            );
        }

        DB::table('listing_categories')->whereIn('id', $ids)->delete();

        /*
         * Дерево справочников лежит в кеше, и удаление строк само по себе
         * приложению не видно. Проверено на проде 11.09: после миграции в
         * базе осталось ноль строк с `escrow`, а API ещё отдавал двенадцать
         * узлов верхнего уровня вместо десяти — обе тестовые категории на
         * месте. Правка данных мимо админки обязана сбрасывать тот же кеш,
         * что сбрасывает админка, иначе она наполовину не состоялась.
         */
        CatalogService::flushCache();
    }

    public function down(): void
    {
        // Намеренно пусто — см. докблок.
    }
};
