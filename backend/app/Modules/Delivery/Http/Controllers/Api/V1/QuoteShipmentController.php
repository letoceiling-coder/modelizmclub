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
class QuoteShipmentController extends Controller
{
    public function __invoke(Request $request, Shipment $shipment, ShipmentService $shipments): JsonResponse
    {
        $shipments->assertParticipant($shipment, $request->user());
        $shipment = $shipments->quote($shipment);
        $shipment->load(['listing', 'seller.profile', 'buyer.profile', 'events']);

        return response()->json([
            'data' => new ShipmentResource($shipment),
        ]);
    }
}
