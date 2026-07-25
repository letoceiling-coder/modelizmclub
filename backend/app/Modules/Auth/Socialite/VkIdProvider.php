<?php

namespace Modules\Auth\Socialite;

use GuzzleHttp\RequestOptions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use RuntimeException;
use SocialiteProviders\Manager\OAuth2\AbstractProvider;
use SocialiteProviders\Manager\OAuth2\User;

/**
 * VK ID (OAuth 2.1 + PKCE) for server-side redirect flow without PHP sessions.
 *
 * @see https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/start-integration/auth-without-sdk/auth-without-sdk-web
 */
class VkIdProvider extends AbstractProvider
{
    public const IDENTIFIER = 'VKID';

    protected $scopes = ['email'];

    protected $scopeSeparator = ' ';

    private ?string $codeVerifier = null;

    private function pkceCacheKey(string $state): string
    {
        return 'oauth:vkid:pkce:'.hash('sha256', $state);
    }

    protected function getAuthUrl($state): string
    {
        return $this->buildAuthUrlFromBase('https://id.vk.ru/authorize', $state);
    }

    protected function getTokenUrl(): string
    {
        return 'https://id.vk.ru/oauth2/auth';
    }

    public function redirect(): RedirectResponse
    {
        $state = $this->generateOAuthToken(43);
        $this->codeVerifier = $this->generateOAuthToken(64);

        Cache::put($this->pkceCacheKey($state), $this->codeVerifier, now()->addMinutes(10));

        return new RedirectResponse($this->getAuthUrl($state));
    }

    public function user()
    {
        $this->hydrateRequestFromPayload();

        return parent::user();
    }

    protected function getCodeFields($state = null): array
    {
        return [
            'response_type' => 'code',
            'client_id' => $this->clientId,
            'redirect_uri' => $this->redirectUrl,
            'state' => $state,
            'code_challenge' => $this->makeCodeChallenge($this->codeVerifier ?? ''),
            'code_challenge_method' => 'S256',
            'scope' => $this->formatScopes($this->getScopes(), $this->scopeSeparator),
            'lang_id' => 0,
        ];
    }

    protected function getTokenFields($code): array
    {
        $this->hydrateRequestFromPayload();

        $state = (string) $this->request->input('state');
        $verifier = Cache::pull($this->pkceCacheKey($state));

        if (! is_string($verifier) || $verifier === '') {
            throw new RuntimeException('VK ID PKCE verifier expired or missing.');
        }

        $fields = [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'client_id' => $this->clientId,
            'redirect_uri' => $this->redirectUrl,
            'code_verifier' => $verifier,
            'device_id' => (string) $this->request->input('device_id'),
            'state' => $state,
        ];

        if (filled($this->clientSecret)) {
            $fields['service_token'] = (string) config('services.vkid.service_token', $this->clientSecret);
        }

        return $fields;
    }

    protected function getUserByToken($token)
    {
        $response = $this->getHttpClient()->post('https://id.vk.ru/oauth2/user_info', [
            RequestOptions::HEADERS => ['Accept' => 'application/json'],
            RequestOptions::FORM_PARAMS => [
                'access_token' => is_array($token) ? $token['access_token'] : $token,
                'client_id' => $this->clientId,
            ],
        ]);

        $contents = (string) $response->getBody();
        $payload = json_decode($contents, true);

        if (! is_array($payload) || ! isset($payload['user'])) {
            throw new RuntimeException('Invalid JSON response from VK ID: '.$contents);
        }

        return $payload['user'];
    }

    protected function mapUserToObject(array $user): User
    {
        return (new User)->setRaw($user)->map([
            'id' => Arr::get($user, 'user_id'),
            'name' => trim(Arr::get($user, 'first_name', '').' '.Arr::get($user, 'last_name', '')),
            'email' => Arr::get($user, 'email'),
            'phone' => Arr::get($user, 'phone'),
            'avatar' => Arr::get($user, 'avatar'),
        ]);
    }

    protected function hasInvalidState(): bool
    {
        return false;
    }

    /** VK ID v2 returns code/state/device_id inside ?payload= JSON. */
    private function hydrateRequestFromPayload(): void
    {
        if ($this->request->filled('code')) {
            return;
        }

        $payload = $this->request->input('payload');
        if (! is_string($payload) || $payload === '') {
            return;
        }

        $data = json_decode($payload, true);
        if (! is_array($data)) {
            return;
        }

        $this->request->merge(array_filter([
            'code' => $data['code'] ?? null,
            'state' => $data['state'] ?? null,
            'device_id' => $data['device_id'] ?? null,
        ], static fn ($value) => $value !== null && $value !== ''));
    }

    /** a-z A-Z 0-9 _ -, length 43..128 per VK ID PKCE spec. */
    private function generateOAuthToken(int $length): string
    {
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
        $max = strlen($chars) - 1;
        $token = '';

        for ($i = 0; $i < $length; $i++) {
            $token .= $chars[random_int(0, $max)];
        }

        return $token;
    }

    private function makeCodeChallenge(string $verifier): string
    {
        $hashed = hash('sha256', $verifier, true);

        return rtrim(strtr(base64_encode($hashed), '+/', '-_'), '=');
    }
}
