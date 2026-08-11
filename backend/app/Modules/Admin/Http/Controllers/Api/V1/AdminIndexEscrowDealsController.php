<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Http\Resources\AdminEscrowDealResource;
use Modules\Admin\Services\AdminEscrowQueryService;

#[Group('Admin — Escrow', weight: 26)]
class AdminIndexEscrowDealsController extends Controller
{
    public function __invoke(Request $request, AdminEscrowQueryService $query): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string'],
            'payment_provider' => ['nullable', 'string'],
            'buyer_id' => ['nullable', 'integer'],
            'seller_id' => ['nullable', 'integer'],
            'dispute' => ['nullable', 'string'],
            'frozen' => ['nullable'],
            'shipment_status' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'q' => ['nullable', 'string', 'max:128'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return AdminEscrowDealResource::collection($query->paginate($filters))->response();
    }
}
