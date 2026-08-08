<?php

use Illuminate\Support\Facades\Route;
use Modules\User\Http\Controllers\Api\V1\BlockController;
use Modules\User\Http\Controllers\Api\V1\FeedbackController;
use Modules\User\Http\Controllers\Api\V1\FollowController;
use Modules\User\Http\Controllers\Api\V1\FriendController;
use Modules\User\Http\Controllers\Api\V1\MyStatsController;
use Modules\User\Http\Controllers\Api\V1\MyStatsViewsDailyController;
use Modules\User\Http\Controllers\Api\V1\IndexUsersController;
use Modules\User\Http\Controllers\Api\V1\InterestsController;
use Modules\User\Http\Controllers\Api\V1\NotificationController;
use Modules\User\Http\Controllers\Api\V1\PresenceHeartbeatController;
use Modules\User\Http\Controllers\Api\V1\PrivacyController;
use Modules\User\Http\Controllers\Api\V1\ReferralController;
use Modules\User\Http\Controllers\Api\V1\SettingsController;
use Modules\User\Http\Controllers\Api\V1\ShowProfileController;
use Modules\User\Http\Controllers\Api\V1\UpdateProfileController;
use Modules\User\Http\Controllers\Api\V1\UserRatingController;
use Modules\User\Http\Controllers\Api\V1\UserReviewsController;

Route::prefix('users')->group(function (): void {
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('me/stats/views-daily', MyStatsViewsDailyController::class);
        Route::get('me/stats', MyStatsController::class);
        Route::get('search', IndexUsersController::class);
        Route::get('me/settings', [SettingsController::class, 'show']);
        Route::get('me/interests', [InterestsController::class, 'show']);
        Route::get('me/referrals', ReferralController::class);

        Route::get('me/notifications', [NotificationController::class, 'index']);
        Route::get('me/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('me/presence', PresenceHeartbeatController::class);

        Route::get('me/blocks', [BlockController::class, 'index']);
        Route::get('me/friends', [FriendController::class, 'indexFriends']);
        Route::get('me/friend-requests', [FriendController::class, 'indexIncomingRequests']);
        Route::get('me/friend-requests/sent', [FriendController::class, 'indexOutgoingRequests']);
    });

    Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
        Route::patch('me', UpdateProfileController::class);
        Route::patch('me/settings', [SettingsController::class, 'update']);
        Route::patch('me/privacy', PrivacyController::class);
        Route::put('me/interests', [InterestsController::class, 'sync']);
        Route::post('me/notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::delete('me/notifications', [NotificationController::class, 'destroyAll']);
        Route::delete('me/notifications/{id}', [NotificationController::class, 'destroy']);
        Route::post('me/notifications/{id}/read', [NotificationController::class, 'markRead']);
        Route::delete('me/friends/{id}', [FriendController::class, 'destroyFriend'])->whereNumber('id');
        Route::post('{id}/friend-request', [FriendController::class, 'storeRequest'])->whereNumber('id');
        Route::post('{id}/follow', [FollowController::class, 'store'])->whereNumber('id');
        Route::delete('{id}/follow', [FollowController::class, 'destroy'])->whereNumber('id');
        Route::post('{id}/block', [BlockController::class, 'store'])->whereNumber('id');
        Route::delete('{id}/block', [BlockController::class, 'destroy'])->whereNumber('id');
    });

    Route::get('{id}/rating', UserRatingController::class)->whereNumber('id');
    Route::get('{id}/reviews', UserReviewsController::class)->whereNumber('id');
    Route::get('{slug}', ShowProfileController::class);
});

Route::middleware('auth:sanctum')->prefix('feedback')->group(function (): void {
    Route::post('/', [FeedbackController::class, 'store']);
});

Route::middleware(['auth:sanctum', 'verified'])->prefix('friend-requests')->group(function (): void {
    Route::post('{id}/accept', [FriendController::class, 'accept'])->whereNumber('id');
    Route::post('{id}/decline', [FriendController::class, 'decline'])->whereNumber('id');
    Route::delete('{id}', [FriendController::class, 'cancel'])->whereNumber('id');
});
