<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Delivery\Services\ShipmentService;

#[Group('Delivery — Webhooks', weight: 54)]
class YandexDeliveryStatusWebhookController extends Controller
{
    public function __invoke(Request $request, ShipmentService $shipments): JsonResponse
    {
        $claimId = $request->query('claim_id');
        $updatedTs = $request->query('updated_ts');

        if (! is_string($claimId) || $claimId === '') {
            return response()->json(['message' => 'ignored'], 200);
        }

        if (str_starts_with($claimId, 'MZ-')) {
            $claimId = substr($claimId, 3);
        }

        $shipment = Shipment::query()
            ->where('provider', 'yandex')
            ->where(function ($q) use ($claimId): void {
                $q->where('external_id', $claimId)
                    ->orWhere('uuid', $claimId);
            })
            ->first();

        if ($shipment === null) {
            return response()->json(['message' => 'ignored'], 200);
        }

        $shipmentId = $shipment->id;

        app()->terminating(function () use ($shipments, $shipmentId, $claimId, $updatedTs): void {
            try {
                $fresh = Shipment::query()->find($shipmentId);
                if ($fresh !== null) {
                    $shipments->syncStatus($fresh);
                }
            } catch (\Throwable $e) {
                Log::warning('Yandex delivery webhook sync failed', [
                    'claim_id' => $claimId,
                    'updated_ts' => $updatedTs,
                    'error' => $e->getMessage(),
                ]);
            }
        });

        return response()->json(['message' => 'ok'], 200);
    }
}
