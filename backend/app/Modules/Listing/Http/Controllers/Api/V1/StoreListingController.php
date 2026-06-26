<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;

class StoreListingController extends Controller
{
    public function __invoke(Request $request, ListingService $listings): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            'category_id' => ['required', 'integer'],
            'subcategory_id' => ['nullable', 'integer'],
            'price_cents' => ['nullable', 'integer', 'min:0'],
            'city_id' => ['nullable', 'integer'],
            'delivery_methods' => ['nullable', 'array'],
        ]);

        $listing = $listings->create($request->user(), $data);

        return response()->json([
            'data' => new ListingResource($listing->load(['category', 'subcategory', 'city'])),
        ], 201);
    }
}
