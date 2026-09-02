<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Modules\Listing\Services\ListingPlacementPricingService;

class PlacementQuoteController extends Controller
{
    public function __invoke(Request $request, ListingPlacementPricingService $pricing, CategoryTaxonomyService $taxonomy): JsonResponse
    {
        $data = $request->validate([
            'taxonomy_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'subcategory_id' => ['nullable', 'integer'],
            'promocode' => ['nullable', 'string', 'max:64'],
        ]);

        $categoryId = $data['category_id'] ?? null;
        $subcategoryId = $data['subcategory_id'] ?? null;
        if (! empty($data['taxonomy_id']) || $categoryId) {
            $pair = $taxonomy->resolveListingCategoryInput(
                $categoryId ? (int) $categoryId : null,
                $subcategoryId ? (int) $subcategoryId : null,
                ! empty($data['taxonomy_id']) ? (int) $data['taxonomy_id'] : null,
            );
            $categoryId = $pair['category_id'];
            $subcategoryId = $pair['subcategory_id'];
        }

        $quote = $pricing->quote(
            $request->user(),
            $categoryId,
            $subcategoryId,
            $data['promocode'] ?? null,
        );

        return response()->json(['data' => $quote]);
    }
}
