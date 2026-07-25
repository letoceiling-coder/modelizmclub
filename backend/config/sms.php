<?php

return [

    /*
    |--------------------------------------------------------------------------
    | SMS driver
    |--------------------------------------------------------------------------
    | iqsms — JSON API https://api.iqsms.ru (see iqsms.ru/api/api_about/)
    | log   — write message to laravel.log (local/staging)
    */
    'driver' => env('SMS_DRIVER', 'iqsms'),

    'iqsms' => [
        'access_point' => rtrim(env('IQSMS_ACCESS_POINT', 'https://api.iqsms.ru'), '/'),
        'login' => env('IQSMS_LOGIN'),
        'password' => env('IQSMS_PASSWORD'),
        'sender' => env('IQSMS_SENDER', 'ModelizmClub'),
    ],

    'verification' => [
        'code_length' => 6,
        'ttl_minutes' => (int) env('SMS_CODE_TTL_MINUTES', 10),
        'resend_cooldown_seconds' => (int) env('SMS_RESEND_COOLDOWN_SECONDS', 60),
        'max_verify_attempts' => (int) env('SMS_MAX_VERIFY_ATTEMPTS', 5),
    ],

    'rate_limits' => [
        'send_per_user' => [
            'max' => (int) env('SMS_SEND_PER_USER_MAX', 3),
            'decay_minutes' => (int) env('SMS_SEND_PER_USER_DECAY', 10),
        ],
        'send_per_phone' => [
            'max' => (int) env('SMS_SEND_PER_PHONE_MAX', 5),
            'decay_minutes' => (int) env('SMS_SEND_PER_PHONE_DECAY', 60),
        ],
        'send_per_ip' => [
            'max' => (int) env('SMS_SEND_PER_IP_MAX', 10),
            'decay_minutes' => (int) env('SMS_SEND_PER_IP_DECAY', 60),
        ],
    ],

    'message' => 'Код подтверждения МоДелизМ: :code. Действует :minutes мин.',

];
