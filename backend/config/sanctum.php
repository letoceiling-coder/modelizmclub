<?php

use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
use Laravel\Sanctum\Sanctum;

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful Domains
    |--------------------------------------------------------------------------
    |
    | Requests from the following domains / hosts will receive stateful API
    | authentication cookies. Typically, these should include your local
    | and production domains which access your API via a frontend SPA.
    |
    */

    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
        Sanctum::currentApplicationUrlWithPort(),
        // Sanctum::currentRequestHost(),
    ))),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Guards
    |--------------------------------------------------------------------------
    |
    | This array contains the authentication guards that will be checked when
    | Sanctum is trying to authenticate a request. If none of these guards
    | are able to authenticate the request, Sanctum will use the bearer
    | token that's present on an incoming request for authentication.
    |
    */

    'guard' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Expiration Minutes
    |--------------------------------------------------------------------------
    |
    | This value controls the number of minutes until an issued token will be
    | considered expired. This will override any values set in the token's
    | "expires_at" attribute, but first-party sessions are not affected.
    |
    */

    /*
     * Год.
     *
     * До 03.10 стоял `null` — токены не истекали вовсе. Само по себе это не
     * дыра, но ценой утечки: токен, однажды попавший в журнал nginx или в
     * выгрузку, открывал учётку бессрочно. Утечку закрыли отдельно (токен
     * больше не едет в адресной строке, см. `OAuthHandoffService`), а срок —
     * это предел ущерба от следующей, какой бы она ни была.
     *
     * Год, а не месяц: это посадочная площадка, люди заходят редко, и
     * выкидывать их из приложения каждые тридцать дней — решение
     * продуктовое, а не про безопасность. Год при этом короче, чем «никогда».
     *
     * ЧТО ПРОИЗОЙДЁТ ПРИ ВЫКАТКЕ. Срок считается от `created_at` токена, то
     * есть при развёртывании перестанут работать токены старше года. На
     * 03.10 самый старый токен моложе (проект живёт с лета 2026), так что из
     * приложения не выйдет никто; через год начнут выходить те, кто не
     * заходил всё это время. Проверить перед выкаткой:
     *
     *   select min(created_at) from personal_access_tokens;
     *
     * Протухшие строки убирает `sanctum:prune-expired`; если его в
     * расписании нет, таблица будет расти — это уборка, не доступ.
     */
    'expiration' => (int) env('SANCTUM_EXPIRATION_MINUTES', 60 * 24 * 365),

    /*
    |--------------------------------------------------------------------------
    | Token Prefix
    |--------------------------------------------------------------------------
    |
    | Sanctum can prefix new tokens in order to take advantage of numerous
    | security scanning initiatives maintained by open source platforms
    | that notify developers if they commit tokens into repositories.
    |
    | See: https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning
    |
    */

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Middleware
    |--------------------------------------------------------------------------
    |
    | When authenticating your first-party SPA with Sanctum you may need to
    | customize some of the middleware Sanctum uses while processing the
    | request. You may change the middleware listed below as required.
    |
    */

    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],

];
