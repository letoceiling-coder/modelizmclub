<?php

use Illuminate\Support\Facades\Route;
use Modules\Auth\Http\Controllers\Api\V1\ConsentController;
use Modules\Auth\Http\Controllers\Api\V1\ForgotPasswordController;
use Modules\Auth\Http\Controllers\Api\V1\LoginController;
use Modules\Auth\Http\Controllers\Api\V1\LogoutController;
use Modules\Auth\Http\Controllers\Api\V1\MeController;
use Modules\Auth\Http\Controllers\Api\V1\OAuthController;
use Modules\Auth\Http\Controllers\Api\V1\RegisterController;
use Modules\Auth\Http\Controllers\Api\V1\ResetPasswordController;
use Modules\Auth\Http\Controllers\Api\V1\VerifyEmailController;

Route::prefix('auth')->group(function (): void {
    Route::middleware('throttle:auth-register')->post('register', RegisterController::class);
    Route::middleware('throttle:auth-register')->post('verify-email', VerifyEmailController::class);
    Route::middleware('throttle:auth-login')->post('login', LoginController::class);
    Route::middleware('throttle:auth-register')->post('forgot-password', ForgotPasswordController::class);
    Route::middleware('throttle:auth-register')->post('reset-password', ResetPasswordController::class);

    Route::get('oauth/{provider}/redirect', [OAuthController::class, 'redirect']);
    Route::get('oauth/{provider}/callback', [OAuthController::class, 'callback']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('logout', LogoutController::class);
        Route::post('consent', ConsentController::class);
        Route::get('me', MeController::class);
    });
});
