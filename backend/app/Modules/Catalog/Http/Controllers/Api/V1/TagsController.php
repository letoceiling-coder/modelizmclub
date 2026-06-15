<?php

namespace Modules\Catalog\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Catalog\Http\Resources\TagResource;
use Modules\Catalog\Services\CatalogService;

class TagsController extends Controller
{
    public function __invoke(Request $request, CatalogService $catalog): JsonResponse
    {
        return response()->json([
            'data' => TagResource::collection(
                $catalog->searchTags($request->string('q')->toString() ?: null),
            ),
        ]);
    }
}
