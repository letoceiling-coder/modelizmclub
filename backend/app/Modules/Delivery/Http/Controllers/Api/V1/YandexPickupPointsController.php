<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Services\Carriers\YandexDeliveryAdapter;
use Modules\Delivery\Services\DeliveryCarrierRegistry;

#[Group('Delivery — Yandex', weight: 52)]
class YandexPickupPointsController extends Controller
{
    #[QueryParameter('geo_id', description: 'Geo ID населённого пункта', example: 213)]
    public function __invoke(Request $request, DeliveryCarrierRegistry $registry): JsonResponse
    {
        $registry->assertEnabled('yandex');

        $filters = $request->validate([
            'geo_id' => ['nullable', 'integer'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'available_for_dropoff' => ['nullable', 'boolean'],
        ]);

        $adapter = app(YandexDeliveryAdapter::class);

        return response()->json([
            'data' => $adapter->listPickupPoints($filters),
        ]);
    }
}
