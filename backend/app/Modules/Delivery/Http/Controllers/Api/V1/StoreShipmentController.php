<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Delivery\Http\Resources\ShipmentResource;
use Modules\Delivery\Services\ShipmentService;

#[Group('Delivery — Shipments', weight: 53)]
class StoreShipmentController extends Controller
{
    public function __invoke(Request $request, ShipmentService $shipments): JsonResponse
    {
        $data = $request->validate([
            'listing_uuid' => ['required', 'uuid'],
            'conversation_uuid' => ['nullable', 'uuid'],
            'provider' => ['required', Rule::in(['cdek', 'yandex'])],
            'destination_point' => ['required', 'array'],
            'destination_point.external_point_id' => ['required', 'string'],
            'destination_point.label' => ['nullable', 'string'],
            'destination_point.address' => ['nullable', 'array'],
            'destination_point.city_code' => ['nullable', 'integer'],
            'destination_point.meta' => ['nullable', 'array'],
            'weight_kg' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'dimensions_cm' => ['nullable', 'array'],
        ]);

        $shipment = $shipments->createDraft($request->user(), $data);
        $shipment->load(['listing', 'seller.profile', 'buyer.profile', 'events']);

        return response()->json([
            'data' => new ShipmentResource($shipment),
        ], 201);
    }
}
