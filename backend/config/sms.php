<?php

return [

    /*
    |--------------------------------------------------------------------------
    | SMS driver
    |--------------------------------------------------------------------------
    | Какой шлюз шлёт сообщения. Меняется одним значением в `.env`,
    | пересборкой кеша конфигурации и перезагрузкой php-fpm — без выкатки.
    |
    | iqsms       — JSON API https://api.iqsms.ru (iqsms.ru/api/api_about/)
    | mts         — MTS Marketolog REST API (Рассылки по своей базе PRO)
    | smsdiscount — https://smsdiscount.ru, договор заключён, доступы позже
    | log         — пишет в laravel.log и никуда не шлёт (местная разработка)
    */
    'driver' => env('SMS_DRIVER', 'iqsms'),

    /*
    |--------------------------------------------------------------------------
    | Реестр драйверов
    |--------------------------------------------------------------------------
    | Имя из `driver` ищется здесь. Новый провайдер подключается строкой в
    | этом списке, а не правкой выбора в AppServiceProvider: раньше там
    | стоял `match`, и третий шлюз означал правку кода.
    |
    | Неизвестное имя — это отказ при запуске, а не тихий откат к первому
    | попавшемуся. Опечатка в `SMS_DRIVER` иначе означала бы, что письма
    | уходят не тем шлюзом и никто об этом не узнает.
    */
    'drivers' => [
        'iqsms' => App\Services\Sms\IqSmsClient::class,
        'mts' => App\Services\Sms\MtsMarketologSmsClient::class,
        'smsdiscount' => App\Services\Sms\SmsDiscountClient::class,
        'log' => App\Services\Sms\LogSmsClient::class,
    ],

    'iqsms' => [
        'access_point' => rtrim(env('IQSMS_ACCESS_POINT', 'https://api.iqsms.ru'), '/'),
        'login' => env('IQSMS_LOGIN'),
        'password' => env('IQSMS_PASSWORD'),
        'sender' => env('IQSMS_SENDER', 'ModelizmClub'),
    ],

    'mts' => [
        /** basic — login/password (Basic auth); token — Bearer token from ЛК */
        'auth' => env('MTS_AUTH', 'basic'),
        'login' => env('MTS_LOGIN'),
        'password' => env('MTS_PASSWORD'),
        'token' => env('MTS_TOKEN'),
        /** Approved sender name from MTS Marketolog cabinet (MODELIZM) */
        'sender' => env('MTS_SENDER', 'MODELIZM'),
        'omnichannel_url' => rtrim(env('MTS_OMNICHANNEL_URL', 'https://omnichannel.mts.ru/http-api/v1'), '/'),
        'token_api_url' => rtrim(env('MTS_TOKEN_API_URL', 'https://api.mts.ru/client-omni-adapter_production/1.0.2/mcom/messageManagement/messages'), '/'),
    ],

    /*
    | SMS-дисконт. Доступов пока нет — значения появятся в `.env`.
    |
    | Имена полей запроса вынесены сюда намеренно: проверить их на живом
    | шлюзе нельзя, и если в документации провайдера они окажутся иными,
    | это правка настроек, а не кода.
    */
    'smsdiscount' => [
        'url' => env('SMSDISCOUNT_URL', 'https://smsdiscount.ru/sys/send.php'),
        'login' => env('SMSDISCOUNT_LOGIN'),
        'password' => env('SMSDISCOUNT_PASSWORD'),
        'sender' => env('SMSDISCOUNT_SENDER', 'MODELIZM'),
        'format' => env('SMSDISCOUNT_FORMAT', '3'),
        'timeout' => (int) env('SMSDISCOUNT_TIMEOUT', 15),
        'fields' => [
            'login' => env('SMSDISCOUNT_FIELD_LOGIN', 'login'),
            'password' => env('SMSDISCOUNT_FIELD_PASSWORD', 'psw'),
            'phone' => env('SMSDISCOUNT_FIELD_PHONE', 'phones'),
            'text' => env('SMSDISCOUNT_FIELD_TEXT', 'mes'),
            'sender' => env('SMSDISCOUNT_FIELD_SENDER', 'sender'),
            'format' => env('SMSDISCOUNT_FIELD_FORMAT', 'fmt'),
        ],
    ],

    'verification' => [
        'code_length' => 6,
        'ttl_minutes' => (int) env('SMS_CODE_TTL_MINUTES', 10),
        'resend_cooldown_seconds' => (int) env('SMS_RESEND_COOLDOWN_SECONDS', 60),
        'max_verify_attempts' => (int) env('SMS_MAX_VERIFY_ATTEMPTS', 5),
    ],

    /*
     * Пределы отправки.
     *
     * Прежние 3 на 10 минут ловили обычного человека, а не перебор. Замер по
     * журналу 05.09: отправки в 18:50:08, 18:51:59 и 18:54:50 — паузы 111 и
     * 171 секунда, то есть человек ждал SMS и жал снова, — а на четвёртой
     * попытке в 18:57:51 приходил отказ на 137 секунд. Три нажатия
     * расходуются за две минуты (пауза между ними всё равно 60 секунд), и
     * дальше остаётся ждать восемь минут без кода на руках.
     *
     * Пять на те же 10 минут дают четыре повтора и восстанавливаются так же
     * быстро; удлинять окно нельзя — оно же определяет, сколько ждать после
     * того, как предел взят.
     *
     * Предел на номер — денежный: он ограничивает стоимость, а не темп.
     * Пять в час были ниже пользовательского предела и срабатывали бы
     * раньше него, оставляя человека без отправки на 45 минут.
     *
     * Предел на IP поднят, потому что за одним адресом сидит оператор
     * мобильной связи целиком: 10 в час — это десять разных людей.
     */
    'rate_limits' => [
        'send_per_user' => [
            'max' => (int) env('SMS_SEND_PER_USER_MAX', 5),
            'decay_minutes' => (int) env('SMS_SEND_PER_USER_DECAY', 10),
        ],
        'send_per_phone' => [
            'max' => (int) env('SMS_SEND_PER_PHONE_MAX', 8),
            'decay_minutes' => (int) env('SMS_SEND_PER_PHONE_DECAY', 60),
        ],
        'send_per_ip' => [
            'max' => (int) env('SMS_SEND_PER_IP_MAX', 30),
            'decay_minutes' => (int) env('SMS_SEND_PER_IP_DECAY', 60),
        ],
    ],

];
