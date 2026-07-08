<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Services\ShipmentService;

#[Group('Delivery — Webhooks', weight: 54)]
class YandexDeliveryStatusWebhookController extends Controller
{
    public function __invoke(Request $request, ShipmentService $shipments): JsonResponse
    {
        $payload = $request->all();
        $requestId = $request->query('claim_id')
            ?? $request->query('request_id')
            ?? data_get($payload, 'request_id')
            ?? data_get($payload, 'operator_request_id');
        $status = data_get($payload, 'status')
            ?? data_get($payload, 'state.status');

        if (is_string($requestId) && str_starts_with($requestId, 'MZ-')) {
            $requestId = substr($requestId, 3);
        }

        if ($requestId === null || $requestId === '') {
            return response()->json(['message' => 'ignored'], 202);
        }

        $shipment = Shipment::query()
            ->where('provider', 'yandex')
            ->where(function ($q) use ($requestId): void {
                $q->where('external_id', (string) $requestId)
                    ->orWhere('uuid', (string) $requestId);
            })
            ->first();

        if ($shipment === null) {
            return response()->json(['message' => 'ignored'], 202);
        }

        // Express API sends only claim_id + updated_ts — pull fresh status from provider.
        if (! is_string($status) || $status === '') {
            $shipments->syncStatus($shipment);

            return response()->json(['message' => 'ok', 'synced' => true]);
        }

        $tracking = data_get($payload, 'tracking_number');

        $shipments->applyWebhookUpdate(
            $shipment,
            $status,
            is_string($tracking) ? $tracking : null,
            array_merge($payload, $request->query()),
        );

        return response()->json(['message' => 'ok']);
    }
}
