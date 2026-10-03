<?php

return [

    'paths' => ['api/*', 'broadcasting/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    /*
     * Умолчание — только боевые домены.
     *
     * До 03.10 в нём стояли ещё `http://localhost:3000` и
     * `http://127.0.0.1:3000`, причём при `supports_credentials => true`. То
     * есть любая страница, отданная с этого порта на машине человека — чужой
     * dev-сервер, пакет из npm, локальное приложение, — ходила к боевому API
     * с его учётными данными и читала ответы.
     *
     * Умолчание действует чаще, чем кажется: по разбору в
     * `frontend/docs/backend-endpoints-needed.md` на стенде переменной
     * `CORS_ALLOWED_ORIGINS` не было вовсе, и работал именно этот список.
     *
     * Для местной разработки адрес добавляется в свой `.env`, а не живёт в
     * умолчании для всех:
     *
     *   CORS_ALLOWED_ORIGINS=https://modelizmclub.ru,http://localhost:3000
     */
    'allowed_origins' => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS',
        'https://modelizmclub.ru,https://www.modelizmclub.ru'
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
