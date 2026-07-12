<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Account\Services\PaymentMethodService;

class DestroyPaymentMethodController extends Controller
{
    public function __invoke(Request $request, string $id, PaymentMethodService $methods): JsonResponse
    {
        $methods->delete($request->user(), $id);

        return response()->json(['message' => 'ok']);
    }
}
