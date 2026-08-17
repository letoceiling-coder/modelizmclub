<?php

namespace Modules\Auth\Socialite;

use Illuminate\Support\Arr;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\ProviderInterface;
use Laravel\Socialite\Two\User;

/**
 * OAuth2 provider for MAX messenger (max.ru) — spec v4.0 §T7.
 *
 * Endpoints are configurable through config('services.max.*') so they can be
 * adjusted to MAX's production/sandbox hosts without a code change.
 */
class MaxProvider extends AbstractProvider implements ProviderInterface
{
    protected $scopeSeparator = ' ';

    protected function getScopes(): array
    {
        $scopes = (array) config('services.max.scopes', ['profile', 'email', 'phone']);

        return array_values(array_filter($scopes));
    }

    protected function getAuthUrl($state): string
    {
        $base = rtrim((string) config('services.max.auth_url', 'https://oauth.max.ru/authorize'), '/');

        return $this->buildAuthUrlFromBase($base, $state);
    }

    protected function getTokenUrl(): string
    {
        return rtrim((string) config('services.max.token_url', 'https://oauth.max.ru/token'), '/');
    }

    /**
     * @param  string  $token
     * @return array<string, mixed>
     */
    protected function getUserByToken($token): array
    {
        $url = rtrim((string) config('services.max.user_url', 'https://api.max.ru/oauth/userinfo'), '/');

        $response = $this->getHttpClient()->get($url, [
            'headers' => [
                'Authorization' => 'Bearer '.$token,
                'Accept' => 'application/json',
            ],
        ]);

        return (array) json_decode((string) $response->getBody(), true);
    }

    /**
     * @param  array<string, mixed>  $user
     */
    protected function mapUserToObject(array $user): User
    {
        $id = Arr::get($user, 'id')
            ?? Arr::get($user, 'user_id')
            ?? Arr::get($user, 'sub');

        $name = Arr::get($user, 'name')
            ?? trim((string) Arr::get($user, 'first_name').' '.(string) Arr::get($user, 'last_name'))
            ?: null;

        return (new User)->setRaw($user)->map([
            'id' => (string) $id,
            'nickname' => Arr::get($user, 'username') ?? Arr::get($user, 'login'),
            'name' => $name,
            'email' => Arr::get($user, 'email'),
            'avatar' => Arr::get($user, 'avatar') ?? Arr::get($user, 'photo_url'),
            'phone' => Arr::get($user, 'phone') ?? Arr::get($user, 'phone_number'),
        ]);
    }
}
