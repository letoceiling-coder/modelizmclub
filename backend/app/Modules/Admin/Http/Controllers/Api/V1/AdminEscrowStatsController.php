<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Services\AdminEscrowStatsService;

#[Group('Admin — Escrow', weight: 26)]
class AdminEscrowStatsController extends Controller
{
    public function __invoke(AdminEscrowStatsService $stats): JsonResponse
    {
        return response()->json(['data' => $stats->stats()]);
    }
}
