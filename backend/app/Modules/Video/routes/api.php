<?php

use Illuminate\Support\Facades\Route;
use Modules\Video\Http\Controllers\Api\V1\DestroyVideoController;
use Modules\Video\Http\Controllers\Api\V1\IndexVideoCategoriesController;
use Modules\Video\Http\Controllers\Api\V1\IndexVideosController;
use Modules\Video\Http\Controllers\Api\V1\ShowVideoController;
use Modules\Video\Http\Controllers\Api\V1\StoreVideoCommentController;
use Modules\Video\Http\Controllers\Api\V1\StoreVideoController;
use Modules\Video\Http\Controllers\Api\V1\UpdateVideoController;
use Modules\Video\Http\Controllers\Api\V1\VideoCommentsController;
use Modules\Video\Http\Controllers\Api\V1\VideoReactionController;
use Modules\Video\Http\Controllers\Api\V1\VideoViewController;

Route::get('videos/categories', IndexVideoCategoriesController::class);
Route::get('videos', IndexVideosController::class);
Route::get('videos/{uuid}', ShowVideoController::class)->where('uuid', '[0-9a-f-]{36}');
Route::post('videos/{uuid}/view', VideoViewController::class)->where('uuid', '[0-9a-f-]{36}');
Route::get('videos/{uuid}/comments', VideoCommentsController::class)->where('uuid', '[0-9a-f-]{36}');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('videos', StoreVideoController::class);
    Route::patch('videos/{uuid}', UpdateVideoController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::delete('videos/{uuid}', DestroyVideoController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('videos/{uuid}/react', [VideoReactionController::class, 'store'])->where('uuid', '[0-9a-f-]{36}');
    Route::delete('videos/{uuid}/react', [VideoReactionController::class, 'destroy'])->where('uuid', '[0-9a-f-]{36}');
    Route::post('videos/{uuid}/comments', StoreVideoCommentController::class)->where('uuid', '[0-9a-f-]{36}');
});
