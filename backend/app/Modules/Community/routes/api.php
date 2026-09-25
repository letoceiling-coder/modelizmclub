<?php

use Illuminate\Support\Facades\Route;
use Modules\Community\Http\Controllers\Api\V1\ApplyCommunityController;
use Modules\Community\Http\Controllers\Api\V1\CommunityChatController;
use Modules\Community\Http\Controllers\Api\V1\CommunityEventsController;
use Modules\Community\Http\Controllers\Api\V1\CommunityFavoriteController;
use Modules\Community\Http\Controllers\Api\V1\CommunityInviteController;
use Modules\Community\Http\Controllers\Api\V1\CommunityJoinRequestsController;
use Modules\Community\Http\Controllers\Api\V1\CommunityMembersController;
use Modules\Community\Http\Controllers\Api\V1\CommunityNotificationsController;
use Modules\Community\Http\Controllers\Api\V1\CommunityPostsController;
use Modules\Community\Http\Controllers\Api\V1\DeleteCommunityController;
use Modules\Community\Http\Controllers\Api\V1\EventsController;
use Modules\Community\Http\Controllers\Api\V1\IndexCommunityController;
use Modules\Community\Http\Controllers\Api\V1\JoinCommunityController;
use Modules\Community\Http\Controllers\Api\V1\LeaveCommunityController;
use Modules\Community\Http\Controllers\Api\V1\ShowCommunityController;
use Modules\Community\Http\Controllers\Api\V1\SimilarCommunitiesController;
use Modules\Community\Http\Controllers\Api\V1\UpdateCommunityBrandingController;
use Modules\Community\Http\Controllers\Api\V1\UpdateCommunityController;

Route::prefix('communities')->middleware(['communities', 'optionalAuth'])->group(function (): void {
    Route::get('/', IndexCommunityController::class);
    Route::get('{slug}/events', [CommunityEventsController::class, 'index']);
    Route::get('{slug}/members', CommunityMembersController::class);
    Route::get('{slug}/posts', CommunityPostsController::class);
    // Похожие — публично, как и сам список сообществ: ничего сверх того, что
    // отдаёт GET /communities, здесь не появляется.
    Route::get('{slug}/similar', SimilarCommunitiesController::class);
    Route::get('{slug}', ShowCommunityController::class);

    Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
        Route::post('apply', ApplyCommunityController::class);
        Route::post('{slug}/join', JoinCommunityController::class)->middleware('requiresSubscription:community.join');
        Route::delete('{slug}/leave', LeaveCommunityController::class);
        Route::get('{slug}/chat', CommunityChatController::class);
        Route::post('{slug}/events', [CommunityEventsController::class, 'store']);
        Route::get('{slug}/join-requests', [CommunityJoinRequestsController::class, 'index']);
        Route::post('{slug}/join-requests/{id}/approve', [CommunityJoinRequestsController::class, 'approve'])
            ->whereNumber('id');
        Route::post('{slug}/join-requests/{id}/reject', [CommunityJoinRequestsController::class, 'reject'])
            ->whereNumber('id');
        Route::delete('{slug}/members/{userUuid}', [CommunityJoinRequestsController::class, 'ban']);
        Route::put('{slug}/notifications', CommunityNotificationsController::class);
        Route::post('{slug}/favorite', [CommunityFavoriteController::class, 'store']);
        Route::delete('{slug}/favorite', [CommunityFavoriteController::class, 'destroy']);
        Route::get('{slug}/invitable-friends', [CommunityInviteController::class, 'index']);
        Route::post('{slug}/invite', [CommunityInviteController::class, 'store']);
        Route::patch('{slug}/branding', UpdateCommunityBrandingController::class);
        Route::patch('{slug}', UpdateCommunityController::class);
        Route::delete('{slug}', DeleteCommunityController::class);
    });
});

/*
 * Мероприятия по адресу события, а не сообщества: у события площадки
 * сообщества нет. Не под флагом сообществ — события площадки живут без них.
 */
Route::prefix('events')->middleware(['optionalAuth'])->group(function (): void {
    Route::get('/', [EventsController::class, 'index']);
    Route::get('{uuid}', [EventsController::class, 'show'])->whereUuid('uuid');
    Route::get('{uuid}/attendees', [EventsController::class, 'attendees'])->whereUuid('uuid');

    Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
        Route::patch('{uuid}', [EventsController::class, 'update'])->whereUuid('uuid');
        Route::delete('{uuid}', [EventsController::class, 'destroy'])->whereUuid('uuid');
        Route::post('{uuid}/cancel', [EventsController::class, 'cancel'])->whereUuid('uuid');
        Route::post('{uuid}/remind', [EventsController::class, 'remind'])->whereUuid('uuid');
        Route::post('{uuid}/attendance', [EventsController::class, 'attend'])->whereUuid('uuid');
        Route::delete('{uuid}/attendance', [EventsController::class, 'unattend'])->whereUuid('uuid');
    });
});
