<?php

use Illuminate\Support\Facades\Route;
use Modules\Channel\Http\Controllers\Api\V1\ChannelController;

Route::middleware('auth:sanctum')->prefix('channels')->group(function (): void {
    Route::get('/', [ChannelController::class, 'index']);
    Route::get('{slug}', [ChannelController::class, 'show']);
    Route::get('{slug}/posts', [ChannelController::class, 'posts']);
    Route::post('{slug}/subscribe', [ChannelController::class, 'subscribe']);
    Route::delete('{slug}/subscribe', [ChannelController::class, 'unsubscribe']);
    Route::post('{slug}/posts', [ChannelController::class, 'storePost']);
});
