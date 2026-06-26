<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;

class IndexListingsController extends Controller
{
    public function __invoke(Request $request, ListingService $listings): JsonResponse
    {
        $paginator = $listings->list([
            'category_id' => $request->integer('category_id') ?: null,
            'city_id' => $request->integer('city_id') ?: null,
            'q' => $request->string('q')->toString() ?: null,
        ], $request->integer('per_page', 20));

        return ListingResource::collection($paginator)->response();
    }
}
