<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Delivery\Services\AdminDeliveryStatsService;

#[Group('Admin — Delivery', weight: 25)]
class AdminDeliveryStatsController extends Controller
{
    public function __invoke(AdminDeliveryStatsService $stats): JsonResponse
    {
        return response()->json(['data' => $stats->stats()]);
    }
}
