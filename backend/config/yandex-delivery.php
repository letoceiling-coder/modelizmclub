<?php

return [

    'enabled' => env('YANDEX_DELIVERY_ENABLED', false),

    'token' => env('YANDEX_DELIVERY_TOKEN'),

    'api_url' => rtrim(env('YANDEX_DELIVERY_API_URL', 'https://b2b-authproxy.taxi.yandex.net'), '/'),

    'timeout' => (float) env('YANDEX_DELIVERY_TIMEOUT', 15.0),

];
