<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Listing\Http\Requests\AiSuggestRequest;
use Modules\Listing\Services\ListingSuggestionManager;

#[Group('Listings', weight: 40)]
class AiSuggestListingController extends Controller
{
    /**
     * ИИ-помощник: по названию/описанию/подсказкам с фото предлагает
     * категорию, черновик описания и теги. Провайдер настраивается
     * в config/listing.php (heuristic по умолчанию, openai опционально).
     */
    public function __invoke(AiSuggestRequest $request, ListingSuggestionManager $suggestions): JsonResponse
    {
        $result = $suggestions->suggest([
            'title' => $request->string('title')->toString() ?: null,
            'description' => $request->string('description')->toString() ?: null,
            'hints' => array_values(array_filter((array) $request->input('hints', []), 'is_string')),
        ]);

        return response()->json(['data' => $result]);
    }
}
