<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'vkontakte' => [
        'client_id' => env('VKONTAKTE_CLIENT_ID'),
        'client_secret' => env('VKONTAKTE_CLIENT_SECRET'),
        'service_token' => env('VKONTAKTE_SERVICE_TOKEN', env('VKONTAKTE_CLIENT_SECRET')),
        'redirect' => env('VKONTAKTE_REDIRECT_URI'),
    ],

    'vkid' => [
        'client_id' => env('VKONTAKTE_CLIENT_ID'),
        'client_secret' => env('VKONTAKTE_CLIENT_SECRET'),
        'service_token' => env('VKONTAKTE_SERVICE_TOKEN', env('VKONTAKTE_CLIENT_SECRET')),
        'redirect' => env('VKONTAKTE_REDIRECT_URI'),
    ],

    'yandex' => [
        'client_id' => env('YANDEX_CLIENT_ID'),
        'client_secret' => env('YANDEX_CLIENT_SECRET'),
        'redirect' => env('YANDEX_REDIRECT_URI'),
    ],

    'max' => [
        'client_id' => env('MAX_CLIENT_ID'),
        'client_secret' => env('MAX_CLIENT_SECRET'),
        'redirect' => env('MAX_REDIRECT_URI'),
        'auth_url' => env('MAX_AUTH_URL', 'https://oauth.max.ru/authorize'),
        'token_url' => env('MAX_TOKEN_URL', 'https://oauth.max.ru/token'),
        'user_url' => env('MAX_USER_URL', 'https://api.max.ru/oauth/userinfo'),
    ],

];
