<?php

use Illuminate\Support\Facades\Route;
use Modules\Account\Http\Controllers\Api\V1\ClearViewHistoryController;
use Modules\Account\Http\Controllers\Api\V1\IndexViewHistoryController;
use Modules\Account\Http\Controllers\Api\V1\StoreViewHistoryController;

Route::middleware('auth:sanctum')->prefix('me')->group(function (): void {
    Route::get('view-history', IndexViewHistoryController::class);
    Route::post('view-history', StoreViewHistoryController::class);
    Route::delete('view-history', ClearViewHistoryController::class);
});
