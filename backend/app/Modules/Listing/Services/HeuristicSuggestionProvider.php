<?php

namespace Modules\Listing\Services;

use App\Models\ListingCategory;
use Illuminate\Support\Str;
use Modules\Listing\Contracts\ListingSuggestionProvider;

/**
 * Офлайн-подсказчик: сопоставляет текст объявления с названиями активных
 * категорий по пересечению слов и генерирует черновик описания и теги.
 * Не делает внешних запросов — используется по умолчанию и как fallback.
 */
class HeuristicSuggestionProvider implements ListingSuggestionProvider
{
    private const STOP_WORDS = [
        'и', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'за', 'из', 'к', 'о', 'об',
        'the', 'a', 'an', 'for', 'with', 'and', 'new', 'новый', 'новая', 'продам',
        'продаю', 'продается', 'куплю', 'бу', 'б', 'у',
    ];

    public function suggest(array $context): array
    {
        $text = trim(implode(' ', array_filter([
            $context['title'] ?? null,
            $context['description'] ?? null,
            implode(' ', $context['hints'] ?? []),
        ])));

        $tokens = $this->tokenize($text);

        $categories = ListingCategory::query()
            ->where('is_active', true)
            ->get(['id', 'name', 'slug']);

        $scored = [];
        foreach ($categories as $category) {
            $catTokens = $this->tokenize($category->name);
            if ($catTokens === []) {
                continue;
            }

            $overlap = array_intersect($tokens, $catTokens);
            if ($overlap === []) {
                continue;
            }

            $score = round(count($overlap) / count($catTokens), 3);
            $scored[] = [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'score' => $score,
            ];
        }

        usort($scored, fn ($a, $b) => $b['score'] <=> $a['score']);
        $candidates = array_slice($scored, 0, 3);
        $best = $candidates[0] ?? null;

        return [
            'category' => $best ? [
                'id' => $best['id'],
                'name' => $best['name'],
                'slug' => $best['slug'],
            ] : null,
            'category_candidates' => $candidates,
            'description' => $this->draftDescription($context, $best['name'] ?? null),
            'tags' => $this->tags($tokens),
            'source' => 'heuristic',
        ];
    }

    /** @return list<string> */
    private function tokenize(?string $text): array
    {
        if (! $text) {
            return [];
        }

        $normalized = Str::lower($text);
        $normalized = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $normalized) ?? '';
        $parts = preg_split('/\s+/u', trim($normalized)) ?: [];

        $tokens = array_filter($parts, fn ($t) => mb_strlen($t) >= 3 && ! in_array($t, self::STOP_WORDS, true));

        return array_values(array_unique($tokens));
    }

    private function draftDescription(array $context, ?string $categoryName): string
    {
        $title = trim((string) ($context['title'] ?? ''));
        $existing = trim((string) ($context['description'] ?? ''));

        if ($existing !== '') {
            return $existing;
        }

        $subject = $title !== '' ? $title : ($categoryName ?? 'Товар');

        return implode("\n", [
            "Продаётся: {$subject}.",
            'Состояние: укажите (новое / отличное / хорошее).',
            'Комплектация и особенности: опишите ключевые характеристики.',
            'Причина продажи и возможность осмотра — по договорённости.',
        ]);
    }

    /**
     * @param  list<string>  $tokens
     * @return list<string>
     */
    private function tags(array $tokens): array
    {
        return array_slice($tokens, 0, 5);
    }
}
