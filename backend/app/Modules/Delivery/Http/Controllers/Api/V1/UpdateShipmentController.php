<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Http\Resources\ShipmentResource;
use Modules\Delivery\Services\ShipmentService;

#[Group('Delivery — Shipments', weight: 53)]
class UpdateShipmentController extends Controller
{
    public function __invoke(Request $request, Shipment $shipment, ShipmentService $shipments): JsonResponse
    {
        $shipments->assertParticipant($shipment, $request->user());

        $data = $request->validate([
            'seller_point_id' => ['sometimes', 'integer', 'exists:seller_delivery_profiles,id'],
            'destination_point' => ['sometimes', 'array'],
            'weight_kg' => ['sometimes', 'numeric', 'min:0.01', 'max:100'],
            'dimensions_cm' => ['sometimes', 'nullable', 'array'],
        ]);

        $shipment = $shipments->updateDraft($shipment, $request->user(), $data);
        $shipment->load(['listing', 'seller.profile', 'buyer.profile', 'events']);

        return response()->json([
            'data' => new ShipmentResource($shipment),
        ]);
    }
}
