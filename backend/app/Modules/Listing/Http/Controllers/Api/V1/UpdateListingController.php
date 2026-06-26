<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;

class UpdateListingController extends Controller
{
    public function __invoke(string $uuid, Request $request, ListingService $listings): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'string', 'max:10000'],
            'category_id' => ['sometimes', 'integer'],
            'subcategory_id' => ['nullable', 'integer'],
            'price_cents' => ['sometimes', 'integer', 'min:0'],
            'city_id' => ['nullable', 'integer'],
            'delivery_methods' => ['sometimes', 'array'],
            'media_ids' => ['sometimes', 'array'],
            'media_ids.*' => ['string'],
        ]);

        $listing = $listings->findOwned($uuid, $request->user());
        $listing = $listings->update($listing, $request->user(), $data);

        return response()->json([
            'data' => new ListingResource($listing),
        ]);
    }
}
