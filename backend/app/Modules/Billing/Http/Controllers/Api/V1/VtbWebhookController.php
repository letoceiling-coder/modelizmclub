<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Billing\Services\VtbPaymentGateway;
use Modules\Billing\Support\VtbCallbackChecksumValidator;
use Symfony\Component\HttpFoundation\Response;

class VtbWebhookController extends Controller
{
    public function __invoke(Request $request, VtbPaymentGateway $gateway): JsonResponse
    {
        $payload = $request->all();
        $token = (string) config('billing.vtb.callback_token');

        if ($token !== '') {
            $checksum = (string) ($payload['checksum'] ?? '');

            if ($checksum === '') {
                Log::warning('VTB webhook rejected: missing checksum while callback token configured');

                return response()->json(['status' => 'invalid_checksum'], Response::HTTP_BAD_REQUEST);
            }

            $validator = new VtbCallbackChecksumValidator($token);

            if (! $validator->valid($payload)) {
                Log::warning('VTB webhook rejected: checksum mismatch', [
                    'mdOrder' => $payload['mdOrder'] ?? null,
                ]);

                return response()->json(['status' => 'invalid_checksum'], Response::HTTP_BAD_REQUEST);
            }
        }

        $gateway->handleWebhook($payload);

        return response()->json(['status' => 'ok']);
    }
}
