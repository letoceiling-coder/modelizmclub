<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Services\SellerStatsService;

class MyStatsController extends Controller
{
    public function __invoke(Request $request, SellerStatsService $stats): JsonResponse
    {
        return response()->json($stats->aggregate($request->user()));
    }
}
