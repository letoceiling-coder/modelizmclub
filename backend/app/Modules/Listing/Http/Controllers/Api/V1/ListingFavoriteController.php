<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Services\ListingService;

class ListingFavoriteController extends Controller
{
    public function store(Request $request, string $uuid, ListingService $listings): JsonResponse
    {
        $listing = $listings->findByUuid($uuid);
        $listings->addFavorite($listing, $request->user());

        return response()->json([
            'data' => [
                'uuid' => $listing->uuid,
                'favorites_count' => $listing->fresh()->favorites_count,
                'is_favorite' => true,
            ],
        ]);
    }

    public function destroy(Request $request, string $uuid, ListingService $listings): JsonResponse
    {
        $listing = $listings->findByUuid($uuid);
        $listings->removeFavorite($listing, $request->user());

        return response()->json([
            'data' => [
                'uuid' => $listing->uuid,
                'favorites_count' => $listing->fresh()->favorites_count,
                'is_favorite' => false,
            ],
        ]);
    }
}
