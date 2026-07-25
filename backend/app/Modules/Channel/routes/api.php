<?php

use Illuminate\Support\Facades\Route;
use Modules\Channel\Http\Controllers\Api\V1\ApplyChannelController;
use Modules\Channel\Http\Controllers\Api\V1\ChannelController;
use Modules\Channel\Http\Controllers\Api\V1\DeleteChannelController;
use Modules\Channel\Http\Controllers\Api\V1\UpdateChannelController;

Route::middleware('auth:sanctum')->prefix('channels')->group(function (): void {
    Route::get('/', [ChannelController::class, 'index']);
    Route::get('{slug}', [ChannelController::class, 'show']);
    Route::get('{slug}/posts', [ChannelController::class, 'posts']);
});

Route::middleware(['auth:sanctum', 'verified'])->prefix('channels')->group(function (): void {
    Route::post('apply', ApplyChannelController::class);
    Route::post('{slug}/subscribe', [ChannelController::class, 'subscribe']);
    Route::delete('{slug}/subscribe', [ChannelController::class, 'unsubscribe']);
    Route::patch('{slug}/branding', [ChannelController::class, 'updateBranding']);
    Route::patch('{slug}', UpdateChannelController::class);
    Route::post('{slug}/posts', [ChannelController::class, 'storePost']);
    Route::delete('{slug}', DeleteChannelController::class);
});
