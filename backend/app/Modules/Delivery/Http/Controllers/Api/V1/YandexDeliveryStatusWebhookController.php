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
        $requestId = data_get($payload, 'request_id') ?? data_get($payload, 'operator_request_id');
        $status = data_get($payload, 'status');
        $tracking = data_get($payload, 'tracking_number');

        $shipment = Shipment::query()
            ->when($requestId, function ($q) use ($requestId): void {
                $q->where('external_id', (string) $requestId)
                    ->orWhere('uuid', str_starts_with((string) $requestId, 'MZ-')
                        ? substr((string) $requestId, 3)
                        : (string) $requestId);
            })
            ->where('provider', 'yandex')
            ->first();

        if ($shipment === null) {
            return response()->json(['message' => 'ignored'], 202);
        }

        $shipments->applyWebhookUpdate(
            $shipment,
            is_string($status) ? $status : null,
            is_string($tracking) ? $tracking : null,
            $payload,
        );

        return response()->json(['message' => 'ok']);
    }
}
