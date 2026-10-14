<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Auth\Services\PhoneVerificationService;

class IqSmsMobileIdWebhookController extends Controller
{
    public function __invoke(Request $request, PhoneVerificationService $phones): JsonResponse
    {
        $secret = (string) config('sms.iqsms.webhook_secret', '');
        if ($secret !== '') {
            $token = (string) $request->query('token', '');
            if (! hash_equals($secret, $token)) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        /** @var array<string, mixed> $payload */
        $payload = $request->json()->all();
        if ($payload === []) {
            $payload = $request->all();
        }

        $phones->handleIqSmsWebhook($payload);

        return response()->json(['status' => 'ok']);
    }
}
