<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Http\Resources\ShipmentResource;
use Modules\Delivery\Services\AdminDeliveryStatsService;

#[Group('Admin — Delivery', weight: 25)]
class AdminIndexShipmentsController extends Controller
{
    #[QueryParameter('status', example: 'error')]
    #[QueryParameter('provider', example: 'cdek')]
    public function __invoke(Request $request, AdminDeliveryStatsService $stats): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string'],
            'provider' => ['nullable', 'in:cdek,yandex'],
            'seller_id' => ['nullable', 'integer'],
            'buyer_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $paginator = $stats->paginate($filters);

        return ShipmentResource::collection($paginator)->response();
    }
}
