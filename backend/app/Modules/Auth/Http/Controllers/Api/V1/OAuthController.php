<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use Modules\Auth\Services\MaxAuthService;
use Modules\Auth\Services\OAuthService;
use Symfony\Component\HttpFoundation\Response;

class OAuthController extends Controller
{
    private const PROVIDERS = ['vk', 'yandex', 'max'];

    public function redirect(Request $request, string $provider, MaxAuthService $max): RedirectResponse|JsonResponse
    {
        if (! $this->isSupported($provider)) {
            return response()->json(['message' => 'Неподдерживаемый OAuth-провайдер.'], 404);
        }

        if (! $this->isConfigured($provider)) {
            return response()->json([
                'message' => 'OAuth-провайдер не настроен. Добавьте ключи в .env на сервере.',
                'provider' => $provider,
            ], 503);
        }

        if ($provider === 'max') {
            return app(MaxAuthController::class)->start($request, $max);
        }

        $driver = Socialite::driver($this->socialiteDriver($provider));

        if ($provider === 'yandex') {
            $driver = $driver->stateless();
        }

        return $driver->redirect()->withHeaders([
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
            'Pragma' => 'no-cache',
        ]);
    }

    public function callback(Request $request, string $provider, OAuthService $oauth): RedirectResponse|JsonResponse
    {
        if (! $this->isSupported($provider)) {
            return response()->json(['message' => 'Неподдерживаемый OAuth-провайдер.'], 404);
        }

        if (! $this->isConfigured($provider)) {
            return response()->json(['message' => 'OAuth-провайдер не настроен.'], 503);
        }

        if ($request->filled('error')) {
            return $this->redirectToFrontend(['oauth_error' => (string) $request->query('error')]);
        }

        if (! $request->filled('code') && ! $request->filled('payload')) {
            return $this->redirectToFrontend(['oauth_error' => 'auth_failed']);
        }

        try {
            $driver = Socialite::driver($this->socialiteDriver($provider));
            if ($provider === 'yandex') {
                $driver = $driver->stateless();
            }
            $socialUser = $driver->user();
            $result = $oauth->resolveUser($provider, $socialUser);
        } catch (\Throwable $e) {
            report($e);

            return $this->redirectToFrontend(['oauth_error' => 'auth_failed']);
        }

        return $this->redirectToFrontend([
            'oauth_token' => $result['token'],
            'oauth_provider' => $provider,
        ]);
    }

    private function isSupported(string $provider): bool
    {
        return in_array($provider, self::PROVIDERS, true);
    }

    private function isConfigured(string $provider): bool
    {
        return match ($provider) {
            'vk' => filled(config('services.vkontakte.client_id')),
            'yandex' => filled(config('services.yandex.client_id')),
            'max' => filled(config('services.max.bot_token')),
            default => false,
        };
    }

    private function socialiteDriver(string $provider): string
    {
        return match ($provider) {
            'vk' => 'vkid',
            default => $provider,
        };
    }

    /** Redirect back to the SPA with token or error in query string. */
    private function redirectToFrontend(array $params): RedirectResponse
    {
        $base = rtrim((string) config('app.frontend_url'), '/');
        $query = http_build_query($params);

        return redirect()->away("{$base}/login?{$query}", Response::HTTP_FOUND);
    }
}
