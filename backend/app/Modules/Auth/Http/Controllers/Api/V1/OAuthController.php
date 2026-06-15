<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OAuthController extends Controller
{
    private const PROVIDERS = ['vk', 'yandex'];

    public function redirect(string $provider): JsonResponse
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

        return response()->json([
            'message' => 'OAuth redirect будет доступен после подключения Socialite-провайдера.',
            'provider' => $provider,
        ], 501);
    }

    public function callback(Request $request, string $provider): JsonResponse
    {
        if (! $this->isSupported($provider)) {
            return response()->json(['message' => 'Неподдерживаемый OAuth-провайдер.'], 404);
        }

        if (! $this->isConfigured($provider)) {
            return response()->json(['message' => 'OAuth-провайдер не настроен.'], 503);
        }

        return response()->json([
            'message' => 'OAuth callback будет доступен после подключения Socialite-провайдера.',
            'provider' => $provider,
        ], 501);
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
}
