<?php

namespace Modules\Admin\Http\Controllers\Api\V1\Concerns;

use Illuminate\Validation\ValidationException;

/**
 * Дерево объявлений и дерево сообществ правятся только через дерево
 * направлений. Отдельная правка здесь и развела списки: в каталоге
 * оказались разделы, которых нет в форме подачи, а в сообществах —
 * брошенные узлы после переименований (разбор 17.09).
 */
trait DerivedCategoryTree
{
    protected function refuseDirectEdit(): never
    {
        throw ValidationException::withMessages([
            'category' => ['Категории правятся в дереве направлений: там же флаги «Объявления» и «Сообщества» и цены размещения.'],
        ]);
    }
}
