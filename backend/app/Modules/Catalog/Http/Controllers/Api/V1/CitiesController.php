<?php

namespace Modules\Catalog\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Catalog\Http\Resources\CityResource;
use Modules\Catalog\Services\CatalogService;

class CitiesController extends Controller
{
    public function __invoke(Request $request, CatalogService $catalog): JsonResponse
    {
        return response()->json([
            'data' => CityResource::collection(
                $catalog->cities($request->string('q')->toString() ?: null),
            ),
        ]);
    }
}
