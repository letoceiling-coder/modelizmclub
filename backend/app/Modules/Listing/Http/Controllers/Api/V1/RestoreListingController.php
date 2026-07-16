<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;

class RestoreListingController extends Controller
{
    public function __invoke(string $uuid, Request $request, ListingService $listings): JsonResponse
    {
        $listing = $listings->findOwnedTrashed($uuid, $request->user());
        $listing = $listings->restore($listing, $request->user());

        return response()->json([
            'data' => new ListingResource($listing),
            'message' => 'Объявление восстановлено.',
        ]);
    }
}
