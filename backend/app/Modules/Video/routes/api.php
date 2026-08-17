<?php

use Illuminate\Support\Facades\Route;
use Modules\Video\Http\Controllers\Api\V1\CancelScheduledVideoController;
use Modules\Video\Http\Controllers\Api\V1\DestroyVideoController;
use Modules\Video\Http\Controllers\Api\V1\IndexVideoCategoriesController;
use Modules\Video\Http\Controllers\Api\V1\IndexVideoTagsController;
use Modules\Video\Http\Controllers\Api\V1\IndexVideosController;
use Modules\Video\Http\Controllers\Api\V1\ScheduleVideoController;
use Modules\Video\Http\Controllers\Api\V1\ShowVideoController;
use Modules\Video\Http\Controllers\Api\V1\StoreVideoCommentController;
use Modules\Video\Http\Controllers\Api\V1\StoreVideoController;
use Modules\Video\Http\Controllers\Api\V1\UpdateVideoController;
use Modules\Video\Http\Controllers\Api\V1\VideoCommentsController;
use Modules\Video\Http\Controllers\Api\V1\VideoReactionController;
use Modules\Video\Http\Controllers\Api\V1\VideoViewController;

// Viewing reviews is open to everyone (spec v4.0 §1.3). optionalAuth resolves
// the signed-in user (for reaction state) without rejecting guests.
Route::middleware('optionalAuth')->group(function (): void {
    Route::get('videos/categories', IndexVideoCategoriesController::class);
    Route::get('videos/tags', IndexVideoTagsController::class);
    Route::get('videos', IndexVideosController::class);
    Route::get('videos/{uuid}', ShowVideoController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('videos/{uuid}/view', VideoViewController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::get('videos/{uuid}/comments', VideoCommentsController::class)->where('uuid', '[0-9a-f-]{36}');
});

// Owner-only lifecycle actions.
Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
    Route::delete('videos/{uuid}/schedule', CancelScheduledVideoController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::delete('videos/{uuid}', DestroyVideoController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::delete('videos/{uuid}/react', [VideoReactionController::class, 'destroy'])->where('uuid', '[0-9a-f-]{36}');
});

// Publishing content and interacting requires an active subscription (spec v4.0 §1.3).
Route::middleware(['auth:sanctum', 'verified', 'requiresSubscription'])->group(function (): void {
    Route::post('videos', StoreVideoController::class);
    Route::patch('videos/{uuid}', UpdateVideoController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('videos/{uuid}/schedule', ScheduleVideoController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('videos/{uuid}/react', [VideoReactionController::class, 'store'])->where('uuid', '[0-9a-f-]{36}');
    Route::post('videos/{uuid}/comments', StoreVideoCommentController::class)->where('uuid', '[0-9a-f-]{36}');
});
