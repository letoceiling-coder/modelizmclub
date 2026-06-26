<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FaqCategory;
use Illuminate\Http\JsonResponse;

class FaqController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $categories = FaqCategory::query()
            ->where('is_active', true)
            ->with(['articles' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get()
            ->map(fn (FaqCategory $c) => [
                'id' => $c->id,
                'slug' => $c->slug,
                'name' => $c->name,
                'articles' => $c->articles->map(fn ($a) => [
                    'id' => $a->id,
                    'question' => $a->question,
                    'answer' => $a->answer,
                ]),
            ]);

        return response()->json(['data' => $categories]);
    }
}
