<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;
use Modules\Listing\Support\ListingFormRules;

class StoreListingController extends Controller
{
    public function __invoke(Request $request, ListingService $listings): JsonResponse
    {
        $data = $request->validate(
            ListingFormRules::store(),
            ListingFormRules::messages(),
            ListingFormRules::attributes(),
        );

        $listing = $listings->create($request->user(), $data);

        return response()->json([
            'data' => new ListingResource($listing),
        ], 201);
    }
}
