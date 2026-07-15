<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Active payment provider
    |--------------------------------------------------------------------------
    |
    | auto  — VTB if configured, else YooKassa, else stub (dev)
    | vtb   — force VTB acquiring
    | yookassa — force YooKassa
    | stub  — local prototype without external gateway
    |
    */
    'provider' => env('BILLING_PROVIDER', 'auto'),

    'currency' => env('BILLING_CURRENCY', 'RUB'),

    'frontend_url' => rtrim(env('FRONTEND_URL', 'https://modelizmclub.ru'), '/'),

    'return_url' => env('BILLING_RETURN_URL', env('FRONTEND_URL', 'https://modelizmclub.ru').'/subscription?payment=success'),

    'fail_url' => env('BILLING_FAIL_URL', env('FRONTEND_URL', 'https://modelizmclub.ru').'/subscription?payment=failed'),

    /*
    |--------------------------------------------------------------------------
    | VTB Internet Acquiring (primary)
    |--------------------------------------------------------------------------
    |
    | REST API docs: https://sandbox.vtb.ru/sandbox/ru/integration/api/rest.html
    | Sandbox: https://vtb.rbsuat.com/payment/rest/
    | Production: https://platezh.vtb24.ru/payment/rest/
    |
    | Client: ИП Михайлов Дмитрий Михайлович — расчётный счёт в ВТБ.
    |
    */
    'vtb' => [
        'enabled' => env('VTB_ACQUIRING_ENABLED', false),
        'api_url' => rtrim(env('VTB_ACQUIRING_API_URL', 'https://vtb.rbsuat.com/payment/rest'), '/').'/',
        'username' => env('VTB_ACQUIRING_USERNAME'),
        'password' => env('VTB_ACQUIRING_PASSWORD'),
        'token' => env('VTB_ACQUIRING_TOKEN'),
        // ISO 4217 numeric (643 = RUB)
        'currency_code' => (int) env('VTB_ACQUIRING_CURRENCY', 643),
        'language' => env('VTB_ACQUIRING_LANGUAGE', 'ru'),
    ],

    /*
    |--------------------------------------------------------------------------
    | YooKassa (fallback)
    |--------------------------------------------------------------------------
    |
    | https://yookassa.ru/developers/api
    |
    */
    'yookassa' => [
        'enabled' => env('YOOKASSA_ENABLED', false),
        'shop_id' => env('YOOKASSA_SHOP_ID'),
        'secret_key' => env('YOOKASSA_SECRET_KEY'),
        'api_url' => rtrim(env('YOOKASSA_API_URL', 'https://api.yookassa.ru/v3'), '/'),
    ],

    /*
    |--------------------------------------------------------------------------
    | YooKassa Safe Deal (Безопасная сделка)
    |--------------------------------------------------------------------------
    |
    | @see https://yookassa.ru/developers/solutions-for-platforms/safe-deal/
    |
    */
    'safe_deal' => [
        'enabled' => env('YOOKASSA_SAFE_DEAL_ENABLED', true),
        // Platform commission (% of listing price, remainder goes to seller).
        'platform_fee_percent' => (float) env('YOOKASSA_PLATFORM_FEE_PERCENT', 5),
        // When the platform fee is collected: deal_closed (recommended for marketplaces).
        'fee_moment' => env('YOOKASSA_FEE_MOMENT', 'deal_closed'),
        'return_url' => env('YOOKASSA_ESCROW_RETURN_URL', env('FRONTEND_URL', 'https://modelizmclub.ru').'/ads/{listing_uuid}?escrow=success'),
    ],

];
