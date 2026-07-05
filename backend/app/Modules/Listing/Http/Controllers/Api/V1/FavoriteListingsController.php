<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;

class FavoriteListingsController extends Controller
{
    public function __invoke(Request $request, ListingService $listings): JsonResponse
    {
        $paginator = $listings->favorites($request->user(), min($request->integer('per_page', 20), 50));

        return ListingResource::collection($paginator)->response();
    }
}
