<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Delivery\Http\Resources\ShipmentResource;

#[Group('Admin — Delivery', weight: 25)]
class AdminShowShipmentController extends Controller
{
    public function __invoke(Shipment $shipment): JsonResponse
    {
        $shipment->load(['listing', 'seller.profile', 'buyer.profile', 'events']);

        return response()->json([
            'data' => new ShipmentResource($shipment),
        ]);
    }
}
