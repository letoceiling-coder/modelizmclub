<?php

namespace Modules\Listing\Services;

use Modules\Listing\Contracts\ListingSuggestionProvider;

/**
 * Выбирает активного поставщика ИИ-подсказок по config/listing.php.
 * «Разные варианты»: heuristic (по умолчанию) или openai (с fallback).
 */
class ListingSuggestionManager
{
    public function __construct(
        private readonly HeuristicSuggestionProvider $heuristic,
    ) {}

    public function provider(): ListingSuggestionProvider
    {
        return match (config('listing.ai.provider')) {
            'openai' => new OpenAiSuggestionProvider($this->heuristic),
            default => $this->heuristic,
        };
    }

    /**
     * @param  array{title?: ?string, description?: ?string, hints?: list<string>}  $context
     * @return array<string, mixed>
     */
    public function suggest(array $context): array
    {
        return $this->provider()->suggest($context);
    }
}
