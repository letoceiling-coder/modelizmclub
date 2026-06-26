<?php

use Illuminate\Support\Facades\Route;
use Modules\Billing\Http\Controllers\Api\V1\CreatePaymentController;
use Modules\Billing\Http\Controllers\Api\V1\IndexPlansController;

Route::get('plans', IndexPlansController::class);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('payments', CreatePaymentController::class);
});
