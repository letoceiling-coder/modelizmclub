<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Services\CdekApiExtension;
use Modules\Delivery\Services\DeliveryCarrierRegistry;

#[Group('Delivery — CDEK', weight: 51)]
class CdekCitiesController extends Controller
{
    public function __invoke(Request $request, DeliveryCarrierRegistry $registry, CdekApiExtension $api): JsonResponse
    {
        $registry->assertEnabled('cdek');

        $filters = $request->validate([
            'city' => ['nullable', 'string'],
            'country_codes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'data' => $api->listCities(array_filter($filters)),
        ]);
    }
}
