<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Services\Carriers\CdekDeliveryAdapter;
use Modules\Delivery\Services\DeliveryCarrierRegistry;

#[Group('Delivery — CDEK', weight: 51)]
class CdekPickupPointsController extends Controller
{
    #[QueryParameter('city_code', description: 'Код города СДЭК', example: '270')]
    public function __invoke(Request $request, DeliveryCarrierRegistry $registry): JsonResponse
    {
        $registry->assertEnabled('cdek');

        $filters = $request->validate([
            'city_code' => ['required', 'integer'],
            'type' => ['nullable', 'string'],
        ]);

        $adapter = app(CdekDeliveryAdapter::class);

        return response()->json([
            'data' => $adapter->listPickupPoints($filters),
        ]);
    }
}
