<?php

return [
    'enabled' => env('OZON_DELIVERY_ENABLED', false),
    'api_url' => env('OZON_DELIVERY_API_URL', 'https://api-seller.ozon.ru'),
    'client_id' => env('OZON_DELIVERY_CLIENT_ID'),
    'api_key' => env('OZON_DELIVERY_API_KEY'),
];
