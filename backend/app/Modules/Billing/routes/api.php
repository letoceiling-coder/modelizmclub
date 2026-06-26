<?php

use Illuminate\Support\Facades\Route;
use Modules\Billing\Http\Controllers\Api\V1\ConfirmStubPaymentController;
use Modules\Billing\Http\Controllers\Api\V1\CreatePaymentController;
use Modules\Billing\Http\Controllers\Api\V1\IndexPlansController;
use Modules\Billing\Http\Controllers\Api\V1\PaymentStatusController;
use Modules\Billing\Http\Controllers\Api\V1\ShowPaymentController;
use Modules\Billing\Http\Controllers\Api\V1\SyncPaymentController;
use Modules\Billing\Http\Controllers\Api\V1\VtbWebhookController;
use Modules\Billing\Http\Controllers\Api\V1\YooKassaWebhookController;

Route::get('plans', IndexPlansController::class);

Route::match(['get', 'post'], 'payments/webhooks/vtb', VtbWebhookController::class);
Route::post('payments/webhooks/yookassa', YooKassaWebhookController::class);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('payments', CreatePaymentController::class);
    Route::get('payments/{uuid}', ShowPaymentController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('payments/{uuid}/sync', SyncPaymentController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('payments/{uuid}/confirm-stub', ConfirmStubPaymentController::class)->where('uuid', '[0-9a-f-]{36}');
});
