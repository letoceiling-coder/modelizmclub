<?php

use Illuminate\Support\Facades\Route;
use Modules\Media\Http\Controllers\Api\V1\ConfirmUploadController;
use Modules\Media\Http\Controllers\Api\V1\DirectUploadController;
use Modules\Media\Http\Controllers\Api\V1\FailUploadController;
use Modules\Media\Http\Controllers\Api\V1\ServeMediaController;
use Modules\Media\Http\Controllers\Api\V1\TranscribeMediaController;
use Modules\Media\Http\Controllers\Api\V1\UploadSessionController;

Route::prefix('media')->middleware(['auth:sanctum', 'verified'])->group(function (): void {
    Route::post('/', DirectUploadController::class);
    Route::post('upload-session', [UploadSessionController::class, 'store']);
    Route::post('confirm', ConfirmUploadController::class);
    Route::post('fail', FailUploadController::class);
    Route::post('{uuid}/transcribe', TranscribeMediaController::class)->where('uuid', '[0-9a-f-]{36}');
});

// Public media proxy (streams from the private bucket). Must stay outside auth.
Route::get('media/{uuid}/{variant}', ServeMediaController::class)
    ->where('uuid', '[0-9a-fA-F-]{36}')
    // poster.webp и 720p.mp4 — слоты видео, лежат в той же колонке variants
    // и отдаются тем же контроллером. См. Modules\Media\Services\VideoProcessor.
    ->where('variant', '((thumb|card|medium|large)\.(avif|webp|jpg)|poster\.webp|720p\.mp4)');
Route::get('media/{uuid}', ServeMediaController::class)
    ->where('uuid', '[0-9a-fA-F-]{36}');
