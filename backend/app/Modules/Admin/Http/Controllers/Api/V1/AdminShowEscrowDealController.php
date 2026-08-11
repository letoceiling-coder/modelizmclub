<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Resources\AdminEscrowDealResource;
use Modules\Admin\Services\AdminEscrowQueryService;

#[Group('Admin — Escrow', weight: 26)]
class AdminShowEscrowDealController extends Controller
{
    public function __invoke(string $uuid, AdminEscrowQueryService $query): JsonResponse
    {
        $deal = $query->show($uuid);

        return response()->json(['data' => new AdminEscrowDealResource($deal)]);
    }
}
