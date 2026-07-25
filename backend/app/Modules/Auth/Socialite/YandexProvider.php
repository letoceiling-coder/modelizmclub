<?php

namespace Modules\Auth\Socialite;

use Illuminate\Support\Arr;
use SocialiteProviders\Manager\OAuth2\User;
use SocialiteProviders\Yandex\Provider as BaseYandexProvider;

/**
 * Yandex rejects authorize URLs with an empty scope= query param (invalid_scope).
 * Omit scope when none are requested — permissions from oauth.yandex.ru app settings apply.
 *
 * @see https://yandex.com/dev/id/doc/en/codes/code-url
 */
class YandexProvider extends BaseYandexProvider
{
    /** @see https://yandex.com/dev/id/doc/en/user-information#phone-access */
    protected $scopes = ['login:info', 'login:email', 'login:avatar', 'login:default_phone'];

    protected $scopeSeparator = ' ';

    protected function getCodeFields($state = null): array
    {
        $fields = parent::getCodeFields($state);

        if (($fields['scope'] ?? '') === '') {
            unset($fields['scope']);
        }

        return $fields;
    }

    protected function mapUserToObject(array $user): User
    {
        $phone = Arr::get($user, 'default_phone.number');
        if (! is_string($phone) || $phone === '') {
            $fallback = Arr::get($user, 'default_phone');
            $phone = is_string($fallback) ? $fallback : null;
        }

        return (new User)->setRaw($user)->map([
            'id' => $user['id'],
            'nickname' => $user['login'],
            'name' => Arr::get($user, 'real_name'),
            'email' => Arr::get($user, 'default_email'),
            'avatar' => 'https://avatars.yandex.net/get-yapic/'.Arr::get($user, 'default_avatar_id').'/islands-200',
            'phone' => $phone,
        ]);
    }
}
