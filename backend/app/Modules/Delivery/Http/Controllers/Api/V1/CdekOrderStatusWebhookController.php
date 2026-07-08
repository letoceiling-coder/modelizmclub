<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Services\ShipmentService;

#[Group('Delivery — Webhooks', weight: 54)]
class CdekOrderStatusWebhookController extends Controller
{
    public function __invoke(Request $request, ShipmentService $shipments): JsonResponse
    {
        $payload = $request->all();
        $uuid = data_get($payload, 'uuid') ?? data_get($payload, 'entity.uuid');
        $cdekNumber = data_get($payload, 'cdek_number') ?? data_get($payload, 'entity.cdek_number');
        $status = data_get($payload, 'status.code')
            ?? data_get($payload, 'entity.statuses.0.code')
            ?? data_get($payload, 'attributes.code');

        $shipment = Shipment::query()
            ->where('provider', 'cdek')
            ->where(function ($q) use ($uuid, $cdekNumber): void {
                if ($uuid) {
                    $q->where('external_id', (string) $uuid);
                }
                if ($cdekNumber) {
                    $q->orWhere('tracking_number', (string) $cdekNumber);
                }
            })
            ->first();

        if ($shipment === null) {
            return response()->json(['message' => 'ignored'], 202);
        }

        $shipments->applyWebhookUpdate(
            $shipment,
            is_string($status) ? $status : null,
            $cdekNumber !== null ? (string) $cdekNumber : null,
            $payload,
        );

        return response()->json(['message' => 'ok']);
    }
}
