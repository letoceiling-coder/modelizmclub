<?php

use Illuminate\Support\Facades\Route;
use Modules\Call\Http\Controllers\Api\V1\CallController;
use Modules\Call\Http\Controllers\Api\V1\ClientLogController;
use Modules\Call\Http\Controllers\Api\V1\LiveKitController;

Route::middleware('auth:sanctum')->prefix('calls')->group(function (): void {
    Route::get('ice-servers', [CallController::class, 'iceServers']);
    Route::get('incoming', [CallController::class, 'incoming']);
    Route::get('/', [CallController::class, 'history']);
    Route::post('/', [CallController::class, 'initiate']);
    Route::post('{uuid}/answer', [CallController::class, 'answer']);
    Route::post('{uuid}/restart', [CallController::class, 'restart']);
    Route::post('{uuid}/ice', [CallController::class, 'ice']);
    Route::post('{uuid}/reject', [CallController::class, 'reject']);
    Route::post('{uuid}/hangup', [CallController::class, 'hangup']);

    // Group calls (LiveKit SFU)
    Route::post('livekit/token', [LiveKitController::class, 'token']);
    Route::post('group/invite', [LiveKitController::class, 'invite']);
});

Route::middleware('auth:sanctum')->prefix('diagnostics')->group(function (): void {
    Route::post('logs', [ClientLogController::class, 'store']);
});
