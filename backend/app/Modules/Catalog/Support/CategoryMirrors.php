<?php

namespace Modules\Catalog\Support;

use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Зеркала узла каталога — и что с ними делать при удалении.
 *
 * ЧТО ЗА ЗЕРКАЛА. Узел живёт в `post_categories` и ссылается на свои
 * отражения в `listing_categories` и `community_categories` — по ним
 * работают объявления и сообщества. Удаление узла их не трогало: 29.09
 * админка ответила «Категория удалена», а обе строки остались в базе
 * неактивными сиротами.
 *
 * УДАЛЯЕМ ТОЛЬКО СВОБОДНЫЕ — И «СВОБОДНОЕ» СЧИТАЕМ ПО ВСЕМ ССЫЛКАМ.
 * Первая версия этого класса смотрела только на объявления и сообщества,
 * и ревью нашло три пропущенные ссылки. Каждая ломалась по-своему:
 *
 *   `community_applications` — RESTRICT: удаление упало бы исключением
 *       посреди запроса, ровно от чего класс и должен защищать;
 *   `promocodes.listing_category_id` — SET NULL: промокод, ограниченный
 *       одной категорией, **молча стал бы действовать на все** — проверка
 *       ограничения смотрит именно на эту колонку;
 *   `listing_pricing_rules.category_id` — SET NULL: правило цены под
 *       категорию превратилось бы в пакет по умолчанию, потому что
 *       «по умолчанию» опознаётся как `category_id is null`.
 *
 * Список ссылок ниже полон на 30.09 — и его полноту стережёт проверка
 * `CategoryDeleteRemovesMirrorsTest`: она читает внешние ключи из самой
 * базы и требует, чтобы каждый был либо здесь, либо в списке заведомо
 * безопасных. Рукописный перечень без такого сторожа устаревает молча —
 * этот устарел за один заход.
 */
final class CategoryMirrors
{
    /**
     * Кто ссылается на зеркало. Таблица → колонки.
     *
     * Само-ссылка `parent_id` проверяется отдельно: у неё своё сообщение
     * про вложенные направления.
     *
     * @var array<class-string, array<string, list<string>>>
     */
    private const ССЫЛКИ = [
        ListingCategory::class => [
            'listings' => ['category_id', 'subcategory_id'],
            'promocodes' => ['listing_category_id'],
            'listing_pricing_rules' => ['category_id'],
        ],
        CommunityCategory::class => [
            'communities' => ['category_id'],
            'community_applications' => ['category_id'],
        ],
    ];

    /**
     * Ссылки, которые удалению не мешают, и почему.
     *
     * Открыто ради проверки полноты: она сверяет внешние ключи базы с
     * `ССЫЛКИ` и должна знать, что эти два — не забытые.
     *
     * @var array<string, string>
     */
    public const БЕЗОПАСНЫЕ = [
        // Ссылка самого удаляемого узла на своё зеркало.
        'post_categories.listing_category_id' => 'ссылка удаляемого узла',
        'post_categories.community_category_id' => 'ссылка удаляемого узла',
        // Само-ссылка: проверяется отдельно, со своим сообщением.
        'listing_categories.parent_id' => 'вложенные направления, проверяются отдельно',
        'community_categories.parent_id' => 'вложенные направления, проверяются отдельно',
    ];

    /** @return array<class-string, array<string, list<string>>> */
    public static function references(): array
    {
        return self::ССЫЛКИ;
    }

    /**
     * Убрать зеркала удаляемого узла.
     *
     * @return array{deleted: list<string>, kept: list<string>}
     */
    public static function removeFor(Model $category): array
    {
        if (! $category instanceof PostCategory) {
            return ['deleted' => [], 'kept' => []];
        }

        $удалено = [];
        $оставлено = [];

        foreach ([
            [ListingCategory::class, (int) $category->listing_category_id],
            [CommunityCategory::class, (int) $category->community_category_id],
        ] as [$класс, $id]) {
            if ($id <= 0) {
                continue;
            }

            $зеркало = $класс::query()->find($id);
            if ($зеркало === null) {
                continue;
            }

            $причина = self::blockedBy($класс, $id);
            if ($причина !== null) {
                $оставлено[] = "{$зеркало->name}: {$причина}";

                continue;
            }

            $зеркало->delete();
            $удалено[] = (string) $зеркало->name;
        }

        return ['deleted' => $удалено, 'kept' => $оставлено];
    }

    /**
     * Что держит зеркало, или null — если ничто.
     *
     * Открыто: тем же вопросом задаётся миграция, убирающая сирот от
     * прежнего поведения. Два ответа на один вопрос разошлись бы — и
     * разошлись бы молча.
     *
     * @param  class-string  $класс
     */
    public static function blockedBy(string $класс, int $id): ?string
    {
        $таблица = (new $класс)->getTable();

        $детей = DB::table($таблица)->where('parent_id', $id)->count();
        if ($детей > 0) {
            return "есть вложенные направления ({$детей})";
        }

        foreach (self::ССЫЛКИ[$класс] ?? [] as $чужая => $колонки) {
            $сколько = DB::table($чужая)
                ->where(function ($q) use ($колонки, $id): void {
                    foreach ($колонки as $i => $колонка) {
                        $i === 0 ? $q->where($колонка, $id) : $q->orWhere($колонка, $id);
                    }
                })
                ->count();

            if ($сколько > 0) {
                return "на неё ссылается {$чужая} ({$сколько})";
            }
        }

        return null;
    }
}
