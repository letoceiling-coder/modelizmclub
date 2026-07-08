<?php

namespace Modules\Delivery\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Delivery\Contracts\YandexGateway;
use Modules\Delivery\Services\DeliveryCarrierRegistry;

#[Group('Delivery — Yandex', weight: 52)]
class YandexDetectLocationController extends Controller
{
    public function __invoke(Request $request, DeliveryCarrierRegistry $registry, YandexGateway $yandex): JsonResponse
    {
        $registry->assertEnabled('yandex');

        $data = $request->validate([
            'location' => ['required', 'string', 'max:500'],
        ]);

        return response()->json([
            'data' => $yandex->detectLocation(['location' => $data['location']]),
        ]);
    }
}
