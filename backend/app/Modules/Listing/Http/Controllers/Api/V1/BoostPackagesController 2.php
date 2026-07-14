<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Listing\Services\ListingBoostService;

class BoostPackagesController extends Controller
{
    public function __invoke(ListingBoostService $boost): JsonResponse
    {
        return response()->json([
            'data' => $boost->packages(),
        ]);
    }
}
