<?php

namespace Modules\Catalog\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class CategoryTreeBuilder
{
    /**
     * @param  Collection<int, Model>  $flat
     * @return list<array<string, mixed>>
     */
    public function build(Collection $flat, callable $mapper): array
    {
        $byParent = $flat->groupBy(fn (Model $item) => $item->getAttribute('parent_id') ?? 0);

        $build = function (int $parentId) use ($byParent, $mapper, &$build): array {
            return ($byParent->get($parentId) ?? collect())
                ->sortBy([
                    ['sort_order', 'asc'],
                    ['name', 'asc'],
                ])
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
