<?php

use Illuminate\Support\Facades\Route;
use Modules\Chat\Http\Controllers\Api\V1\IndexConversationsController;
use Modules\Chat\Http\Controllers\Api\V1\IndexMessagesController;
use Modules\Chat\Http\Controllers\Api\V1\StoreConversationController;
use Modules\Chat\Http\Controllers\Api\V1\StoreMessageController;

Route::middleware('auth:sanctum')->prefix('conversations')->group(function (): void {
    Route::get('/', IndexConversationsController::class);
    Route::post('/', StoreConversationController::class);
    Route::get('{uuid}/messages', IndexMessagesController::class);
    Route::post('{uuid}/messages', StoreMessageController::class);
});
