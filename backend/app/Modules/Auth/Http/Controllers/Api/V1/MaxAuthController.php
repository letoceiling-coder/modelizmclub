<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Modules\Auth\Services\MaxAuthService;
use Symfony\Component\HttpFoundation\Response;

class MaxAuthController extends Controller
{
    public function start(Request $request, MaxAuthService $max): JsonResponse|RedirectResponse
    {
        if (! $max->isConfigured()) {
            return response()->json([
                'message' => 'Вход через MAX не настроен.',
                'provider' => 'max',
            ], 503);
        }

        $started = $max->start();

        if ($request->expectsJson() || $request->wantsJson() || $request->header('Accept') === 'application/json') {
            return response()->json(['data' => $started]);
        }

        return redirect()->away($started['bot_url'], Response::HTTP_FOUND)->withHeaders([
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
            'Pragma' => 'no-cache',
        ]);
    }

    public function status(Request $request, MaxAuthService $max): JsonResponse
    {
        $session = (string) $request->query('session', '');
        if (preg_match('/^[a-z0-9]{16,32}$/', $session) !== 1) {
            return response()->json(['message' => 'Некорректная сессия.'], 422);
        }

        return response()->json(['data' => $max->status($session)]);
    }

    public function link(Request $request, MaxAuthService $max): JsonResponse
    {
        if (! $max->isConfigured()) {
            return response()->json([
                'message' => 'Вход через MAX не настроен.',
                'provider' => 'max',
            ], 503);
        }

        return response()->json(['data' => $max->startLink($request->user())]);
    }

    public function unlink(Request $request, MaxAuthService $max): JsonResponse
    {
        $user = $request->user();
        $max->unlink($user);
        $user->unsetRelation('oauthAccounts');

        return response()->json([
            'data' => [
                'oauth_providers' => $user->oauthProviderNames(),
            ],
        ]);
    }
}
