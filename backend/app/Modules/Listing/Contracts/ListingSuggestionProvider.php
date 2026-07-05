<?php

namespace Modules\Listing\Contracts;

interface ListingSuggestionProvider
{
    /**
     * По контексту (название, описание, распознанные объекты с фото) вернуть подсказку.
     *
     * @param  array{title?: ?string, description?: ?string, hints?: list<string>}  $context
     * @return array{category: ?array{id:int,name:string,slug:string}, category_candidates: list<array{id:int,name:string,slug:string,score:float}>, description: string, tags: list<string>, source: string}
     */
    public function suggest(array $context): array;
}
