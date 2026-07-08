<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Http\Resources\ShipmentResource;

#[Group('Admin — Delivery', weight: 25)]
class AdminUpdateShipmentController extends Controller
{
    public function __invoke(Request $request, Shipment $shipment): JsonResponse
    {
        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', 'string'],
        ]);

        $shipment->fill($data);
        $shipment->save();
        $shipment->load(['listing', 'seller.profile', 'buyer.profile', 'events']);

        return response()->json([
            'data' => new ShipmentResource($shipment),
        ]);
    }
}
