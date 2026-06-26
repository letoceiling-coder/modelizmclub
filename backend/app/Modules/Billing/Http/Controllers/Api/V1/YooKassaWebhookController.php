<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\YooKassaPaymentGateway;

class YooKassaWebhookController extends Controller
{
    public function __invoke(Request $request, YooKassaPaymentGateway $gateway): JsonResponse
    {
        /** @var array<string, mixed> $payload */
        $payload = $request->json()->all();
        $gateway->handleWebhook($payload);

        return response()->json(['status' => 'ok']);
    }
}
