<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\PaymentMethodService;

class StorePaymentMethodController extends Controller
{
    public function __invoke(Request $request, PaymentMethodService $methods): JsonResponse
    {
        $result = $methods->startBinding($request->user());

        return response()->json(['data' => $result], 201);
    }
}
