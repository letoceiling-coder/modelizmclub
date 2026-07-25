<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Services\ListingPlacementPricingService;

class PlacementQuoteController extends Controller
{
    public function __invoke(Request $request, ListingPlacementPricingService $pricing): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer', 'exists:listing_categories,id'],
            'subcategory_id' => ['nullable', 'integer', 'exists:listing_categories,id'],
            'promocode' => ['nullable', 'string', 'max:64'],
        ]);

        $quote = $pricing->quote(
            $request->user(),
            $data['category_id'] ?? null,
            $data['subcategory_id'] ?? null,
            $data['promocode'] ?? null,
        );

        return response()->json(['data' => $quote]);
    }
}
