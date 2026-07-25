<?php

use Illuminate\Support\Facades\Route;
use Modules\Report\Http\Controllers\Api\V1\StoreReportController;

Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
    Route::post('reports', StoreReportController::class);
});
