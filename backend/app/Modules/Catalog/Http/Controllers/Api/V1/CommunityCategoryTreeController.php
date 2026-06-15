<?php

namespace Modules\Catalog\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Catalog\Services\CatalogService;

class CommunityCategoryTreeController extends Controller
{
    public function __invoke(CatalogService $catalog): JsonResponse
    {
        return response()->json(['data' => $catalog->communityCategoryTree()]);
    }
}
