<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Auth\Services\PhoneVerificationService;

class IqSmsMobileIdWebhookController extends Controller
{
    public function __invoke(Request $request, PhoneVerificationService $phones): JsonResponse
    {
        Log::info('iqsms mobile-id webhook hit', [
            'ip' => $request->ip(),
            'query_token' => $request->query('token') !== null,
            'type' => $request->input('type'),
            'status' => $request->input('status'),
            'message_id' => $request->input('message_id'),
        ]);

        $secret = (string) config('sms.iqsms.webhook_secret', '');
        if ($secret !== '') {
            $token = (string) ($request->query('token')
                ?? $request->header('X-Iqsms-Webhook-Token')
                ?? '');
            if (! hash_equals($secret, $token)) {
                Log::warning('iqsms mobile-id webhook forbidden', ['ip' => $request->ip()]);

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
