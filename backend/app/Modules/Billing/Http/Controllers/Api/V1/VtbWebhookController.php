<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\VtbPaymentGateway;

class VtbWebhookController extends Controller
{
    public function __invoke(Request $request, VtbPaymentGateway $gateway): JsonResponse
    {
        $gateway->handleWebhook($request->all());

        return response()->json(['status' => 'ok']);
    }
}
