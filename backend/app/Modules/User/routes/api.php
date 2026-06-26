<?php

use Illuminate\Support\Facades\Route;
use Modules\User\Http\Controllers\Api\V1\BlockController;
use Modules\User\Http\Controllers\Api\V1\FollowController;
use Modules\User\Http\Controllers\Api\V1\FriendController;
use Modules\User\Http\Controllers\Api\V1\IndexUsersController;
use Modules\User\Http\Controllers\Api\V1\InterestsController;
use Modules\User\Http\Controllers\Api\V1\PrivacyController;
use Modules\User\Http\Controllers\Api\V1\SettingsController;
use Modules\User\Http\Controllers\Api\V1\ShowProfileController;
use Modules\User\Http\Controllers\Api\V1\UpdateProfileController;

Route::prefix('users')->group(function (): void {
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('search', IndexUsersController::class);
        Route::patch('me', UpdateProfileController::class);
        Route::get('me/settings', [SettingsController::class, 'show']);
        Route::patch('me/settings', [SettingsController::class, 'update']);
        Route::patch('me/privacy', PrivacyController::class);
        Route::get('me/interests', [InterestsController::class, 'show']);
        Route::put('me/interests', [InterestsController::class, 'sync']);
        Route::get('me/blocks', [BlockController::class, 'index']);
        Route::get('me/friends', [FriendController::class, 'indexFriends']);
        Route::delete('me/friends/{id}', [FriendController::class, 'destroyFriend'])->whereNumber('id');
        Route::get('me/friend-requests', [FriendController::class, 'indexIncomingRequests']);
        Route::post('{id}/friend-request', [FriendController::class, 'storeRequest'])->whereNumber('id');
        Route::post('{id}/follow', [FollowController::class, 'store'])->whereNumber('id');
        Route::delete('{id}/follow', [FollowController::class, 'destroy'])->whereNumber('id');
        Route::post('{id}/block', [BlockController::class, 'store'])->whereNumber('id');
    });

    Route::get('{slug}', ShowProfileController::class);
});

Route::middleware('auth:sanctum')->prefix('friend-requests')->group(function (): void {
    Route::post('{id}/accept', [FriendController::class, 'accept'])->whereNumber('id');
    Route::post('{id}/decline', [FriendController::class, 'decline'])->whereNumber('id');
    Route::delete('{id}', [FriendController::class, 'cancel'])->whereNumber('id');
});
