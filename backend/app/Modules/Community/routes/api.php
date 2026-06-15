<?php

use Illuminate\Support\Facades\Route;
use Modules\Community\Http\Controllers\Api\V1\ApplyCommunityController;
use Modules\Community\Http\Controllers\Api\V1\CommunityMembersController;
use Modules\Community\Http\Controllers\Api\V1\CommunityPostsController;
use Modules\Community\Http\Controllers\Api\V1\IndexCommunityController;
use Modules\Community\Http\Controllers\Api\V1\JoinCommunityController;
use Modules\Community\Http\Controllers\Api\V1\LeaveCommunityController;
use Modules\Community\Http\Controllers\Api\V1\ShowCommunityController;

Route::prefix('communities')->group(function (): void {
    Route::get('/', IndexCommunityController::class);
    Route::get('{slug}', ShowCommunityController::class);
    Route::get('{slug}/members', CommunityMembersController::class);
    Route::get('{slug}/posts', CommunityPostsController::class);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('apply', ApplyCommunityController::class);
        Route::post('{slug}/join', JoinCommunityController::class);
        Route::delete('{slug}/leave', LeaveCommunityController::class);
    });
});
