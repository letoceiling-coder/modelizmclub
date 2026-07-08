<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Http\Resources\ShipmentResource;
use Modules\Delivery\Services\ShipmentService;

#[Group('Delivery — Shipments', weight: 53)]
class IndexShipmentsController extends Controller
{
    #[QueryParameter('role', description: 'seller|buyer', example: 'buyer')]
    #[QueryParameter('status', description: 'Фильтр по статусу', example: 'in_transit')]
    public function __invoke(Request $request, ShipmentService $shipments): JsonResponse
    {
        $filters = $request->validate([
            'role' => ['nullable', 'in:seller,buyer'],
            'status' => ['nullable', 'string'],
            'provider' => ['nullable', 'in:cdek,yandex'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $paginator = $shipments->paginateForUser($request->user(), $filters);

        return ShipmentResource::collection($paginator)->response();
    }
}
