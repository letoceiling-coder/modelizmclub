<?php

use App\Services\Sms\IqSmsClient;
use App\Services\Sms\LogSmsClient;
use App\Services\Sms\MtsMarketologSmsClient;

return [

    /*
    |--------------------------------------------------------------------------
    | SMS driver
    |--------------------------------------------------------------------------
    | Какой шлюз шлёт сообщения. Меняется одним значением в `.env`,
    | пересборкой кеша конфигурации и перезагрузкой php-fpm — без выкатки.
    |
    | iqsms — JSON API https://api.iqsms.ru. Это и есть «СМС Дисконт»:
    |         iqsms.ru — сайт этой компании, и кабинет в `.env.example`
    |         называется так же. Двух разных провайдеров здесь нет.
    | mts   — MTS Marketolog REST API (Рассылки по своей базе PRO)
    | log   — пишет в laravel.log и никуда не шлёт (местная разработка)
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
    | Неизвестное имя — отказ, а не тихий откат к первому попавшемуся:
    | опечатка в `SMS_DRIVER` иначе означала бы, что сообщения уходят не
    | тем шлюзом и никто об этом не узнает.
    |
    | Отказ происходит при первой отправке, а не при запуске: привязка
    | ленивая. Чтобы опечатку нашёл не первый живой человек, имя драйвера
    | проверяет `deploy/scripts/check-sms-driver.sh` — он вызывается из
    | `smoke-check.sh` после каждой выкатки.
    */
    'drivers' => [
        'iqsms' => IqSmsClient::class,
        'mts' => MtsMarketologSmsClient::class,
        'log' => LogSmsClient::class,
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

    'verification' => [
        /*
         * Длина кода подтверждения — одно место истины (решение З1 от 09.10).
         *
         * До 09.10 это значение здесь лежало и не использовалось ни разу:
         * `grep code_length` по всему бэкенду давал одну строку — эту.
         * Генератор писал 6 своей константой, проверка — регулярным
         * выражением `/^\d{6}$/`, форма — `maxLength={6}` в трёх файлах.
         * Пять мест, и ни одно не смотрело на настройку.
         *
         * Теперь из этого значения строится всё: генератор, проверка на
         * сервере, текст отказа, ответ на запрос кода и по нему — поле ввода
         * во фронтенде. Поменять длину — поменять одно число здесь или
         * `SMS_CODE_LENGTH` в `.env`, без правки интерфейса.
         *
         * Решение З1: код создаёт наш сервер, значит 6 цифр. Границы 4…8
         * стоят не для гибкости, а чтобы опечатка в `.env` не выпустила
         * одноцифровой код и не сломала форму длиной в сто знаков.
         */
        'code_length' => max(4, min(8, (int) env('SMS_CODE_LENGTH', 6))),
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
