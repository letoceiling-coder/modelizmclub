<?php

return [

    /*
    |--------------------------------------------------------------------------
    | ИИ-помощник для объявлений
    |--------------------------------------------------------------------------
    |
    | provider — какой поставщик подсказок использовать:
    |   'heuristic' — офлайн-эвристика (без внешних вызовов, работает всегда);
    |   'openai'    — OpenAI-совместимый API (нужны ключ и endpoint).
    |
    | При недоступности внешнего провайдера сервис безопасно откатывается
    | на эвристику, поэтому endpoint всегда возвращает результат.
    |
    */

    'ai' => [
        'provider' => env('LISTING_AI_PROVIDER', 'heuristic'),

        'openai' => [
            'base_url' => env('LISTING_AI_OPENAI_BASE_URL', 'https://api.openai.com/v1'),
            'api_key' => env('LISTING_AI_OPENAI_KEY'),
            'model' => env('LISTING_AI_OPENAI_MODEL', 'gpt-4o-mini'),
            'timeout' => (int) env('LISTING_AI_OPENAI_TIMEOUT', 15),
        ],
    ],

];
