<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Services\ListingService;

class RecentPickupAddressesController extends Controller
{
    public function __invoke(Request $request, ListingService $listings): JsonResponse
    {
        return response()->json([
            'data' => $listings->recentPickupAddresses($request->user()),
        ]);
    }
}
