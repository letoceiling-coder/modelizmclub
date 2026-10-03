<?php

use Illuminate\Support\Facades\Route;
use Modules\Auth\Http\Controllers\Api\V1\ConsentController;
use Modules\Auth\Http\Controllers\Api\V1\ForgotPasswordController;
use Modules\Auth\Http\Controllers\Api\V1\LoginController;
use Modules\Auth\Http\Controllers\Api\V1\LogoutController;
use Modules\Auth\Http\Controllers\Api\V1\LogoutOthersController;
use Modules\Auth\Http\Controllers\Api\V1\MeController;
use Modules\Auth\Http\Controllers\Api\V1\MaxAuthController;
use Modules\Auth\Http\Controllers\Api\V1\MaxWebhookController;
use Modules\Auth\Http\Controllers\Api\V1\OAuthController;
use Modules\Auth\Http\Controllers\Api\V1\OAuthExchangeController;
use Modules\Auth\Http\Controllers\Api\V1\RegisterController;
use Modules\Auth\Http\Controllers\Api\V1\ResetPasswordController;
use Modules\Auth\Http\Controllers\Api\V1\VerifyEmailController;

Route::prefix('auth')->group(function (): void {
    Route::middleware('throttle:auth-register')->post('register', RegisterController::class);
    Route::middleware('throttle:auth-verify')->post('verify-email', VerifyEmailController::class);
    Route::middleware('throttle:auth-login')->post('login', LoginController::class);
    Route::middleware('throttle:auth-forgot-password')->post('forgot-password', ForgotPasswordController::class);
    Route::middleware('throttle:auth-reset-password')->post('reset-password', ResetPasswordController::class);

    Route::get('oauth/{provider}/redirect', [OAuthController::class, 'redirect']);
    Route::get('oauth/{provider}/callback', [OAuthController::class, 'callback']);

    /*
     * Обмен разового кода входа на токен. Код приезжает в адресе вместо
     * токена — см. `OAuthHandoffService`. Лимитер свой, а не `auth-login`: у
     * того ключ по адресу и почте, а почты здесь нет (разбор в
     * `AppServiceProvider`).
     */
    Route::middleware('throttle:auth-oauth-exchange')->post('oauth/exchange', OAuthExchangeController::class);
    Route::middleware('throttle:auth-max-start')->post('oauth/max/start', [MaxAuthController::class, 'start']);
    // Статус опрашивается, а старт нажимается человеком — лимиты у них разные.
    // Пока они были общими (10 в минуту с IP), опрос раз в 1,5 с выбирал бюджет
    // за пятнадцать секунд, отвечал 429 и заодно не давал перезапустить вход.
    Route::middleware('throttle:auth-max-status')->get('oauth/max/status', [MaxAuthController::class, 'status']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('logout', LogoutController::class);
        Route::post('logout-others', LogoutOthersController::class);
        Route::post('consent', ConsentController::class);
        Route::get('me', MeController::class);
        Route::middleware('throttle:auth-max-start')->group(function (): void {
            Route::post('oauth/max/link', [MaxAuthController::class, 'link']);
            Route::delete('oauth/max', [MaxAuthController::class, 'unlink']);
        });
    });
});

Route::post('webhooks/max', MaxWebhookController::class);
