<?php

use Illuminate\Support\Facades\Route;
use Modules\Community\Http\Controllers\Api\V1\ApplyCommunityController;
use Modules\Community\Http\Controllers\Api\V1\CommunityChatController;
use Modules\Community\Http\Controllers\Api\V1\CommunityEventsController;
use Modules\Community\Http\Controllers\Api\V1\CommunityJoinRequestsController;
use Modules\Community\Http\Controllers\Api\V1\CommunityMembersController;
use Modules\Community\Http\Controllers\Api\V1\CommunityPostsController;
use Modules\Community\Http\Controllers\Api\V1\IndexCommunityController;
use Modules\Community\Http\Controllers\Api\V1\JoinCommunityController;
use Modules\Community\Http\Controllers\Api\V1\LeaveCommunityController;
use Modules\Community\Http\Controllers\Api\V1\DeleteCommunityController;
use Modules\Community\Http\Controllers\Api\V1\ShowCommunityController;
use Modules\Community\Http\Controllers\Api\V1\UpdateCommunityBrandingController;
use Modules\Community\Http\Controllers\Api\V1\UpdateCommunityController;

Route::prefix('communities')->middleware(['communities', 'optionalAuth'])->group(function (): void {
    Route::get('/', IndexCommunityController::class);
    Route::get('{slug}/events', [CommunityEventsController::class, 'index']);
    Route::get('{slug}/members', CommunityMembersController::class);
    Route::get('{slug}/posts', CommunityPostsController::class);
    Route::get('{slug}', ShowCommunityController::class);

    Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
        Route::post('apply', ApplyCommunityController::class);
        Route::post('{slug}/join', JoinCommunityController::class);
        Route::delete('{slug}/leave', LeaveCommunityController::class);
        Route::get('{slug}/chat', CommunityChatController::class);
        Route::post('{slug}/events', [CommunityEventsController::class, 'store']);
        Route::post('{slug}/events/{uuid}/attend', [CommunityEventsController::class, 'attend']);
        Route::get('{slug}/join-requests', [CommunityJoinRequestsController::class, 'index']);
        Route::post('{slug}/join-requests/{id}/approve', [CommunityJoinRequestsController::class, 'approve'])
            ->whereNumber('id');
        Route::post('{slug}/join-requests/{id}/reject', [CommunityJoinRequestsController::class, 'reject'])
            ->whereNumber('id');
        Route::delete('{slug}/members/{userUuid}', [CommunityJoinRequestsController::class, 'ban']);
        Route::patch('{slug}/branding', UpdateCommunityBrandingController::class);
        Route::patch('{slug}', UpdateCommunityController::class);
        Route::delete('{slug}', DeleteCommunityController::class);
    });
});
