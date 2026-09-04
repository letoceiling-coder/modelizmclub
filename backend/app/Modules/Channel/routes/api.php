<?php

use Illuminate\Support\Facades\Route;
use Modules\Channel\Http\Controllers\Api\V1\ApplyChannelController;
use Modules\Channel\Http\Controllers\Api\V1\ChannelController;
use Modules\Channel\Http\Controllers\Api\V1\DeleteChannelController;
use Modules\Channel\Http\Controllers\Api\V1\DeleteChannelPostController;
use Modules\Channel\Http\Controllers\Api\V1\UpdateChannelController;

Route::prefix('channels')->middleware('optionalAuth')->group(function (): void {
    Route::get('/', [ChannelController::class, 'index']);
    Route::get('{slug}', [ChannelController::class, 'show']);
    Route::get('{slug}/posts', [ChannelController::class, 'posts']);
    Route::post('{slug}/posts/{postUuid}/view', [ChannelController::class, 'view']);
});

Route::middleware(['auth:sanctum', 'verified'])->prefix('channels')->group(function (): void {
    Route::post('apply', ApplyChannelController::class);
    Route::post('{slug}/subscribe', [ChannelController::class, 'subscribe']);
    Route::delete('{slug}/subscribe', [ChannelController::class, 'unsubscribe']);
    Route::patch('{slug}/branding', [ChannelController::class, 'updateBranding']);
    Route::patch('{slug}', UpdateChannelController::class);
    Route::post('{slug}/posts', [ChannelController::class, 'storePost']);
    Route::post('{slug}/posts/{postUuid}/like', [ChannelController::class, 'like']);
    Route::delete('{slug}/posts/{postUuid}/like', [ChannelController::class, 'unlike']);
    Route::post('{slug}/posts/{postUuid}/pin', [ChannelController::class, 'pin']);
    Route::delete('{slug}/posts/{postUuid}/pin', [ChannelController::class, 'unpin']);
    Route::delete('{slug}/posts/{postUuid}', DeleteChannelPostController::class);
    Route::delete('{slug}', DeleteChannelController::class);
});
