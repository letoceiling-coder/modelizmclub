<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DeliveryMethod;
use Illuminate\Http\JsonResponse;

class IndexDeliveryMethodsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $rows = DeliveryMethod::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['code', 'name', 'is_integrated']);

        return response()->json([
            'data' => $rows->map(fn (DeliveryMethod $m): array => [
                'code' => $m->code,
                'name' => $m->name,
                'is_integrated' => (bool) $m->is_integrated,
            ])->values(),
        ]);
    }
}
