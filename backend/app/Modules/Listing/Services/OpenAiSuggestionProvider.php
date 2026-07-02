<?php

namespace Modules\Listing\Services;

use App\Models\ListingCategory;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Modules\Listing\Contracts\ListingSuggestionProvider;

/**
 * OpenAI-совместимый подсказчик. Требует ключ/endpoint в config/listing.php.
 * При любой ошибке безопасно откатывается на эвристику, чтобы endpoint
 * всегда возвращал результат.
 */
class OpenAiSuggestionProvider implements ListingSuggestionProvider
{
    public function __construct(private readonly HeuristicSuggestionProvider $fallback) {}

    public function suggest(array $context): array
    {
        $config = config('listing.ai.openai');

        if (empty($config['api_key'])) {
            return $this->fallback->suggest($context);
        }

        $categories = ListingCategory::query()
            ->where('is_active', true)
            ->get(['id', 'name', 'slug']);

        try {
            $response = Http::baseUrl(rtrim($config['base_url'], '/'))
                ->withToken($config['api_key'])
                ->timeout($config['timeout'] ?? 15)
                ->post('/chat/completions', [
                    'model' => $config['model'],
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'Ты помощник маркетплейса моделизма. Отвечай строго JSON: '
                                .'{"category_slug": string|null, "description": string, "tags": string[]}. '
                                .'Описание — на русском языке, до 600 символов.',
                        ],
                        [
                            'role' => 'user',
                            'content' => json_encode([
                                'title' => $context['title'] ?? null,
                                'description' => $context['description'] ?? null,
                                'hints' => $context['hints'] ?? [],
                                'categories' => $categories->map(fn ($c) => [
                                    'slug' => $c->slug,
                                    'name' => $c->name,
                                ])->all(),
                            ], JSON_UNESCAPED_UNICODE),
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                return $this->fallback->suggest($context);
            }

            $content = $response->json('choices.0.message.content');
            $parsed = is_string($content) ? json_decode($content, true) : null;

            if (! is_array($parsed)) {
                return $this->fallback->suggest($context);
            }

            $category = $categories->firstWhere('slug', $parsed['category_slug'] ?? null);

            return [
                'category' => $category ? [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                ] : null,
                'category_candidates' => $category ? [[
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'score' => 1.0,
                ]] : [],
                'description' => (string) ($parsed['description'] ?? ''),
                'tags' => array_values(array_filter((array) ($parsed['tags'] ?? []), 'is_string')),
                'source' => 'openai',
            ];
        } catch (\Throwable $e) {
            Log::warning('Listing AI suggest failed, falling back to heuristic', ['error' => $e->getMessage()]);

            return $this->fallback->suggest($context);
        }
    }
}
