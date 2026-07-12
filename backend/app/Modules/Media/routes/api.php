<?php

use Illuminate\Support\Facades\Route;
use Modules\Media\Http\Controllers\Api\V1\ConfirmUploadController;
use Modules\Media\Http\Controllers\Api\V1\DirectUploadController;
use Modules\Media\Http\Controllers\Api\V1\ServeMediaController;
use Modules\Media\Http\Controllers\Api\V1\TranscribeMediaController;
use Modules\Media\Http\Controllers\Api\V1\UploadSessionController;

Route::prefix('media')->middleware('auth:sanctum')->group(function (): void {
    Route::post('/', DirectUploadController::class);
    Route::post('upload-session', [UploadSessionController::class, 'store']);
    Route::post('confirm', ConfirmUploadController::class);
    Route::post('{uuid}/transcribe', TranscribeMediaController::class)->where('uuid', '[0-9a-f-]{36}');
});

// Public media proxy (streams from the private bucket). Must stay outside auth.
Route::get('media/{uuid}', ServeMediaController::class);
