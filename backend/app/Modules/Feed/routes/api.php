<?php

use Illuminate\Support\Facades\Route;
use Modules\Feed\Http\Controllers\Api\V1\CancelScheduledPostController;
use Modules\Feed\Http\Controllers\Api\V1\CommentReactionController;
use Modules\Feed\Http\Controllers\Api\V1\CommentThreadController;
use Modules\Feed\Http\Controllers\Api\V1\DestroyCommentController;
use Modules\Feed\Http\Controllers\Api\V1\DestroyPostController;
use Modules\Feed\Http\Controllers\Api\V1\IndexFeedController;
use Modules\Feed\Http\Controllers\Api\V1\PostBookmarkController;
use Modules\Feed\Http\Controllers\Api\V1\PostCommentsController;
use Modules\Feed\Http\Controllers\Api\V1\PostReactionController;
use Modules\Feed\Http\Controllers\Api\V1\PublishPostController;
use Modules\Feed\Http\Controllers\Api\V1\RepostPostController;
use Modules\Feed\Http\Controllers\Api\V1\SchedulePostController;
use Modules\Feed\Http\Controllers\Api\V1\ShowPostController;
use Modules\Feed\Http\Controllers\Api\V1\StorePostController;
use Modules\Feed\Http\Controllers\Api\V1\UnrepostPostController;
use Modules\Feed\Http\Controllers\Api\V1\UpdatePostController;

Route::get('feed', IndexFeedController::class);

Route::get('posts/{uuid}', ShowPostController::class);
Route::get('posts/{uuid}/comments', [PostCommentsController::class, 'index']);
Route::get('comments/{uuid}/thread', CommentThreadController::class);

Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {
    Route::post('posts', StorePostController::class);
    Route::patch('posts/{uuid}', UpdatePostController::class);
    Route::delete('posts/{uuid}', DestroyPostController::class);
    Route::post('posts/{uuid}/publish', PublishPostController::class);
    Route::post('posts/{uuid}/schedule', SchedulePostController::class);
    Route::delete('posts/{uuid}/schedule', CancelScheduledPostController::class);
    Route::post('posts/{uuid}/react', [PostReactionController::class, 'store']);
    Route::delete('posts/{uuid}/react', [PostReactionController::class, 'destroy']);
    Route::post('posts/{uuid}/bookmark', [PostBookmarkController::class, 'store']);
    Route::delete('posts/{uuid}/bookmark', [PostBookmarkController::class, 'destroy']);
    Route::post('posts/{uuid}/repost', RepostPostController::class);
    Route::delete('posts/{uuid}/repost', UnrepostPostController::class);
    Route::post('posts/{uuid}/comments', [PostCommentsController::class, 'store']);
    Route::delete('comments/{uuid}', DestroyCommentController::class);
    Route::post('comments/{uuid}/react', [CommentReactionController::class, 'store']);
    Route::delete('comments/{uuid}/react', [CommentReactionController::class, 'destroy']);
});
