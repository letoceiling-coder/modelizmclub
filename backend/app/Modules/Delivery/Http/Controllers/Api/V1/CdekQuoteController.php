<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Services\Carriers\CdekDeliveryAdapter;
use Modules\Delivery\Services\DeliveryCarrierRegistry;

#[Group('Delivery — CDEK', weight: 51)]
class CdekQuoteController extends Controller
{
    public function __invoke(Request $request, DeliveryCarrierRegistry $registry): JsonResponse
    {
        $registry->assertEnabled('cdek');

        $data = $request->validate([
            'source_point' => ['required', 'array'],
            'destination_point' => ['required', 'array'],
            'weight_kg' => ['required', 'numeric', 'min:0.01', 'max:100'],
            'dimensions_cm' => ['nullable', 'array'],
            'dimensions_cm.length' => ['nullable', 'integer', 'min:1', 'max:200'],
            'dimensions_cm.width' => ['nullable', 'integer', 'min:1', 'max:200'],
            'dimensions_cm.height' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $adapter = app(CdekDeliveryAdapter::class);
        $result = $adapter->quote(
            $data['source_point'],
            $data['destination_point'],
            [
                'weight_kg' => $data['weight_kg'],
                'dimensions_cm' => $data['dimensions_cm'] ?? null,
            ],
        );

        return response()->json(['data' => $result]);
    }
}
