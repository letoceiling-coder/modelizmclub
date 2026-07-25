<?php

use Illuminate\Support\Facades\Route;
use Modules\Chat\Http\Controllers\Api\V1\ClearConversationHistoryController;
use Modules\Chat\Http\Controllers\Api\V1\DeleteMessageForEveryoneController;
use Modules\Chat\Http\Controllers\Api\V1\DestroyConversationController;
use Modules\Chat\Http\Controllers\Api\V1\HideMessageController;
use Modules\Chat\Http\Controllers\Api\V1\IndexConversationsController;
use Modules\Chat\Http\Controllers\Api\V1\IndexMessagesController;
use Modules\Chat\Http\Controllers\Api\V1\MarkConversationReadController;
use Modules\Chat\Http\Controllers\Api\V1\PinConversationController;
use Modules\Chat\Http\Controllers\Api\V1\PinMessageController;
use Modules\Chat\Http\Controllers\Api\V1\ShowConversationController;
use Modules\Chat\Http\Controllers\Api\V1\ShowCategoryRoomConversationController;
use Modules\Chat\Http\Controllers\Api\V1\StoreAttachmentController;
use Modules\Chat\Http\Controllers\Api\V1\StoreConversationController;
use Modules\Chat\Http\Controllers\Api\V1\StoreMessageController;
use Modules\Chat\Http\Controllers\Api\V1\UnpinConversationController;
use Modules\Chat\Http\Controllers\Api\V1\UnpinMessageController;

Route::middleware('auth:sanctum')->prefix('conversations')->group(function (): void {
    Route::get('/', IndexConversationsController::class);
    Route::get('{uuid}', ShowConversationController::class);
    Route::get('{uuid}/messages', IndexMessagesController::class);
    Route::post('{uuid}/read', MarkConversationReadController::class);
});

Route::middleware('auth:sanctum')->prefix('categories/posts')->group(function (): void {
    Route::get('{parentId}/rooms/{subId}/conversation', ShowCategoryRoomConversationController::class)
        ->whereNumber(['parentId', 'subId']);
});

Route::middleware(['auth:sanctum', 'verified'])->prefix('conversations')->group(function (): void {
    Route::post('/', StoreConversationController::class);
    Route::delete('{uuid}', DestroyConversationController::class);
    Route::post('{uuid}/attachments', StoreAttachmentController::class);
    Route::post('{uuid}/pin', PinConversationController::class);
    Route::delete('{uuid}/pin', UnpinConversationController::class);
    Route::post('{uuid}/messages', StoreMessageController::class);
    Route::delete('{uuid}/messages/{messageUuid}', HideMessageController::class);
    Route::delete('{uuid}/messages/{messageUuid}/everyone', DeleteMessageForEveryoneController::class);
    Route::delete('{uuid}/history', ClearConversationHistoryController::class);
    Route::post('{uuid}/messages/{messageUuid}/pin', PinMessageController::class);
    Route::delete('{uuid}/messages/{messageUuid}/pin', UnpinMessageController::class);
});
