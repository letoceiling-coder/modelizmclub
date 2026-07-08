<?php

return [

    'enabled' => env('YANDEX_DELIVERY_ENABLED', false),

    'token' => env('YANDEX_DELIVERY_TOKEN'),

    'api_url' => rtrim(env('YANDEX_DELIVERY_API_URL', 'https://b2b-authproxy.taxi.yandex.net'), '/'),

    'timeout' => (float) env('YANDEX_DELIVERY_TIMEOUT', 15.0),

    /*
    | Callback URL for status push notifications (per-order, not global).
    | Must end with ? or & — Yandex appends updated_ts=...&claim_id=...
    | @see https://yandex.ru/support/delivery-profile/ru/api/express/openapi/IntegrationV2ClaimsCreate
    */
    'callback_url' => env(
        'YANDEX_DELIVERY_CALLBACK_URL',
        'https://modelizmclub.ru/api/v1/webhooks/yandex/delivery-status?',
    ),

];
