<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Auth\Services\MaxAuthService;

class MaxWebhookController extends Controller
{
    public function __invoke(Request $request, MaxAuthService $max): JsonResponse
    {
        $secret = (string) config('services.max.webhook_secret');
        if ($secret !== '') {
            $header = (string) $request->header('X-Max-Bot-Api-Secret', '');
            if (! hash_equals($secret, $header)) {
                Log::warning('MAX webhook rejected: bad secret');

                return response()->json(['message' => 'Unauthorized.'], 401);
            }
        }

        try {
            $max->handleWebhook($request->all());
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['ok' => true]);
    }
}
