<?php

use Illuminate\Support\Facades\Route;
use Modules\Account\Http\Controllers\Api\V1\ChangeEmailController;
use Modules\Account\Http\Controllers\Api\V1\ChangePasswordController;
use Modules\Account\Http\Controllers\Api\V1\CompleteCardBindingController;
use Modules\Account\Http\Controllers\Api\V1\ConfirmEmailChangeController;
use Modules\Account\Http\Controllers\Api\V1\DestroyPaymentMethodController;
use Modules\Account\Http\Controllers\Api\V1\DisableTwoFactorController;
use Modules\Account\Http\Controllers\Api\V1\IndexPaymentMethodsController;
use Modules\Account\Http\Controllers\Api\V1\ResendEmailChangeController;
use Modules\Account\Http\Controllers\Api\V1\ResendVerificationEmailController;
use Modules\Account\Http\Controllers\Api\V1\SendPhoneVerificationCodeController;
use Modules\Account\Http\Controllers\Api\V1\SetupTwoFactorController;
use Modules\Account\Http\Controllers\Api\V1\ShowDocumentRequisitesController;
use Modules\Account\Http\Controllers\Api\V1\ShowPayoutRequisitesController;
use Modules\Account\Http\Controllers\Api\V1\StorePaymentMethodController;
use Modules\Account\Http\Controllers\Api\V1\UpdateDocumentRequisitesController;
use Modules\Account\Http\Controllers\Api\V1\UpdatePayoutRequisitesController;
use Modules\Account\Http\Controllers\Api\V1\VerifyPhoneController;
use Modules\Account\Http\Controllers\Api\V1\VerifyTwoFactorController;

Route::middleware('auth:sanctum')->prefix('account')->group(function (): void {
    Route::post('change-password', ChangePasswordController::class);
    Route::post('change-email', ChangeEmailController::class);
    Route::post('email', ChangeEmailController::class);
    Route::post('confirm-email', ConfirmEmailChangeController::class);
    Route::post('resend-verification-email', ResendVerificationEmailController::class);
    Route::post('email/verify/resend', ResendEmailChangeController::class);

    Route::middleware('throttle:auth-phone-send')->post('phone/send-code', SendPhoneVerificationCodeController::class);
    Route::middleware('throttle:auth-phone-verify')->post('phone/verify', VerifyPhoneController::class);

    Route::get('requisites', ShowDocumentRequisitesController::class);
    Route::get('payment-methods', IndexPaymentMethodsController::class);
    Route::get('payout-requisites', ShowPayoutRequisitesController::class);
});

Route::middleware(['auth:sanctum', 'verified'])->prefix('account')->group(function (): void {
    Route::put('requisites', UpdateDocumentRequisitesController::class);

    Route::post('payment-methods', StorePaymentMethodController::class);
    Route::delete('payment-methods/{id}', DestroyPaymentMethodController::class)->where('id', '[0-9a-f-]{36}');

    Route::post('2fa/setup', SetupTwoFactorController::class);
    Route::post('2fa/verify', VerifyTwoFactorController::class);
    Route::post('2fa/disable', DisableTwoFactorController::class);

    Route::put('payout-requisites', UpdatePayoutRequisitesController::class);
});

Route::prefix('account')->group(function (): void {
    Route::get('payment-methods/bind/complete', CompleteCardBindingController::class);
});
