<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CDEK API v2 (https://apidoc.cdek.ru/)
    |--------------------------------------------------------------------------
    |
    | Production: https://api.cdek.ru/v2/
    | Test:       https://api.edu.cdek.ru/v2/
    |
    */
    'enabled' => env('CDEK_ENABLED', false),

    'test' => env('CDEK_TEST', true),

    'account' => env('CDEK_ACCOUNT'),

    'secure' => env('CDEK_SECURE'),

    'timeout' => (float) env('CDEK_TIMEOUT', 10.0),

    'api_url' => rtrim(env('CDEK_API_URL', 'https://api.cdek.ru/v2'), '/').'/',

    'api_url_test' => rtrim(env('CDEK_API_URL_TEST', 'https://api.edu.cdek.ru/v2'), '/').'/',

    'token_cache_key' => env('CDEK_TOKEN_CACHE_KEY', 'cdek:oauth:token'),

    'token_cache_ttl_seconds' => (int) env('CDEK_TOKEN_CACHE_TTL', 3500),

];
