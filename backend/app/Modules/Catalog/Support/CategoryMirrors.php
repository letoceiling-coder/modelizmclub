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
 * ПОЧЕМУ ЭТО НЕ МЕЛОЧЬ. Неделей раньше такие же осиротевшие зеркала
 * стоили отдельной миграции: направления потеряли родителей, и
 * восстанавливать их пришлось по зеркалам же. Строка, о которой никто не
 * помнит, однажды всплывает как «откуда это».
 *
 * УДАЛЯЕМ ТОЛЬКО ПУСТЫЕ. У зеркала могут быть свои объявления и
 * сообщества; на уровне базы это защищено `RESTRICT`, то есть попытка
 * удалить непустое упала бы исключением посреди запроса. Поэтому сначала
 * спрашиваем, потом удаляем, а про оставшееся говорим вслух — молчаливое
 * «удалено» и было исходным дефектом.
 */
final class CategoryMirrors
{
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
            [ListingCategory::class, (int) $category->listing_category_id, 'listings', 'объявления'],
            [CommunityCategory::class, (int) $category->community_category_id, 'communities', 'сообщества'],
        ] as [$класс, $id, $таблица, $чем]) {
            if ($id <= 0) {
                continue;
            }

            $зеркало = $класс::query()->find($id);
            if ($зеркало === null) {
                continue;
            }

            $причина = self::занято($класс, $таблица, $id);
            if ($причина !== null) {
                $оставлено[] = "{$зеркало->name}: {$причина}";

                continue;
            }

            $зеркало->delete();
            $удалено[] = (string) $зеркало->name;
        }

        return ['deleted' => $удалено, 'kept' => $оставлено];
    }

    /** Чем зеркало занято, или null — если ничем. */
    private static function занято(string $класс, string $таблица, int $id): ?string
    {
        $детей = $класс::query()->where('parent_id', $id)->count();
        if ($детей > 0) {
            return "есть вложенные направления ({$детей})";
        }

        $колонки = $таблица === 'listings' ? ['category_id', 'subcategory_id'] : ['category_id'];
        $содержимого = DB::table($таблица)
            ->where(function ($q) use ($колонки, $id): void {
                foreach ($колонки as $i => $колонка) {
                    $i === 0 ? $q->where($колонка, $id) : $q->orWhere($колонка, $id);
                }
            })
            ->count();

        return $содержимого > 0 ? "привязано записей: {$содержимого}" : null;
    }
}
