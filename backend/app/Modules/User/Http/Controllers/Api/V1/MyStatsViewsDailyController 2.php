<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Services\SellerStatsService;

class MyStatsViewsDailyController extends Controller
{
    public function __invoke(Request $request, SellerStatsService $stats): JsonResponse
    {
        $range = (string) $request->query('range', '30d');

        return response()->json($stats->viewsDaily($request->user(), $range));
    }
}
