<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;

class MyListingsController extends Controller
{
    public function __invoke(Request $request, ListingService $listings): JsonResponse
    {
        $paginator = $listings->myListings($request->user(), [
            'status' => $request->string('status')->toString() ?: null,
            'q' => $request->string('q')->toString() ?: null,
            'sort' => $request->string('sort')->toString() ?: 'updated',
        ], min($request->integer('per_page', 20), 50));

        return ListingResource::collection($paginator)->response();
    }
}
