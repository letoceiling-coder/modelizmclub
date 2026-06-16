<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Services\AdminDashboardService;

#[Group('Admin — Dashboard', weight: 20)]
class AdminDashboardController extends Controller
{
    public function __invoke(AdminDashboardService $dashboard): JsonResponse
    {
        return response()->json(['data' => $dashboard->stats()]);
    }
}
