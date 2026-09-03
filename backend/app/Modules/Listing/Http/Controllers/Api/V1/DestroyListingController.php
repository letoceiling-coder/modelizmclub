<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Services\ListingService;

class DestroyListingController extends Controller
{
    public function __invoke(string $uuid, Request $request, ListingService $listings): JsonResponse
    {
        $this->authorize('delete', Listing::query()->where('uuid', $uuid)->firstOrFail());
        $listing = $listings->findOwned($uuid, $request->user());
        $listings->delete($listing, $request->user());

        return response()->json(['message' => 'Объявление удалено.']);
    }
}
