<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use Modules\Auth\Services\OAuthService;
use Symfony\Component\HttpFoundation\Response;

class OAuthController extends Controller
{
    private const PROVIDERS = ['vk', 'yandex'];

    public function redirect(string $provider): RedirectResponse|JsonResponse
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

        return Socialite::driver($provider)->stateless()->redirect();
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

        try {
            $socialUser = Socialite::driver($provider)->stateless()->user();
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
            default => false,
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
