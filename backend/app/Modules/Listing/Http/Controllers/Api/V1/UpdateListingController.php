<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;
use Modules\Listing\Support\ListingFormRules;

class UpdateListingController extends Controller
{
    public function __invoke(string $uuid, Request $request, ListingService $listings): JsonResponse
    {
        // Ownership before validation: a stranger gets 403, not a field list.
        $this->authorize('update', Listing::query()->where('uuid', $uuid)->firstOrFail());

        $data = $request->validate(
            ListingFormRules::update(),
            ListingFormRules::messages(),
            ListingFormRules::attributes(),
        );

        $listing = $listings->findOwned($uuid, $request->user());
        $listing = $listings->update($listing, $request->user(), $data);

        return response()->json([
            'data' => new ListingResource($listing),
        ]);
    }
}
