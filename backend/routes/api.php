<?php

use App\Http\Controllers\Api\V1\HealthController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', HealthController::class);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/me', fn () => response()->json(['data' => auth()->user()]));
    });
});
