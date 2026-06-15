<?php

use Illuminate\Support\Facades\Route;
use Modules\User\Http\Controllers\Api\V1\BlockController;
use Modules\User\Http\Controllers\Api\V1\FollowController;
use Modules\User\Http\Controllers\Api\V1\InterestsController;
use Modules\User\Http\Controllers\Api\V1\PrivacyController;
use Modules\User\Http\Controllers\Api\V1\SettingsController;
use Modules\User\Http\Controllers\Api\V1\ShowProfileController;
use Modules\User\Http\Controllers\Api\V1\UpdateProfileController;

Route::prefix('users')->group(function (): void {
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::patch('me', UpdateProfileController::class);
        Route::get('me/settings', [SettingsController::class, 'show']);
        Route::patch('me/settings', [SettingsController::class, 'update']);
        Route::patch('me/privacy', PrivacyController::class);
        Route::get('me/interests', [InterestsController::class, 'show']);
        Route::put('me/interests', [InterestsController::class, 'sync']);
        Route::get('me/blocks', [BlockController::class, 'index']);
        Route::post('{id}/follow', [FollowController::class, 'store'])->whereNumber('id');
        Route::delete('{id}/follow', [FollowController::class, 'destroy'])->whereNumber('id');
        Route::post('{id}/block', [BlockController::class, 'store'])->whereNumber('id');
    });

    Route::get('{slug}', ShowProfileController::class);
});
