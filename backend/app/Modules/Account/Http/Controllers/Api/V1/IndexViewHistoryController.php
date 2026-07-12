<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\ViewHistoryService;

class IndexViewHistoryController extends Controller
{
    public function __invoke(Request $request, ViewHistoryService $history): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        return response()->json($history->list($request->user(), $perPage));
    }
}
