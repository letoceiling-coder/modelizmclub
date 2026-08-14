<?php

return [
    'enabled' => env('POCHTA_DELIVERY_ENABLED', false),
    'api_url' => env('POCHTA_API_URL', 'https://otpravka-api.pochta.ru'),
    'token' => env('POCHTA_API_TOKEN'),
    'key' => env('POCHTA_API_KEY'),
];
