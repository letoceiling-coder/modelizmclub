<?php

namespace Modules\Catalog\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class CategoryTreeBuilder
{
    /**
     * Дерево из плоского списка. Порядок берётся из списка как есть.
     *
     * ЗДЕСЬ БЫЛА ВТОРАЯ СОРТИРОВКА. До C5 строитель пересортировывал
     * каждый ряд по `sort_order, name` — поверх того порядка, в котором
     * список пришёл из базы. Пока обе сортировки говорили одно и то же,
     * этого никто не замечал; как только порядок стал алфавитным, SQL
     * отдавал А–Я, а строитель молча возвращал прежний ряд по номерам.
     *
     * Выглядело это не поломкой, а «переключатель не работает» — и
     * искать пришлось бы в переключателе, а не здесь.
     *
     * `groupBy` порядок внутри группы сохраняет, так что ряд остаётся
     * тем, каким его отдал `CategoryOrder::apply` — единственное место,
     * где порядок решается.
     *
     * @param  Collection<int, Model>  $flat
     * @return list<array<string, mixed>>
     */
    public function build(Collection $flat, callable $mapper): array
    {
        $byParent = $flat->groupBy(fn (Model $item) => $item->getAttribute('parent_id') ?? 0);

        $build = function (int $parentId) use ($byParent, $mapper, &$build): array {
            return ($byParent->get($parentId) ?? collect())
                ->values()
                ->map(function (Model $item) use ($mapper, $build): array {
                    return array_merge($mapper($item), [
                        'children' => $build((int) $item->getKey()),
                    ]);
                })
                ->all();
        };

        return $build(0);
    }
}
