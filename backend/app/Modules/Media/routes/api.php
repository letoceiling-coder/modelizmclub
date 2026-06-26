<?php

use Illuminate\Support\Facades\Route;
use Modules\Media\Http\Controllers\Api\V1\ConfirmUploadController;
use Modules\Media\Http\Controllers\Api\V1\DirectUploadController;
use Modules\Media\Http\Controllers\Api\V1\UploadSessionController;

Route::prefix('media')->middleware('auth:sanctum')->group(function (): void {
    Route::post('/', DirectUploadController::class);
    Route::post('upload-session', [UploadSessionController::class, 'store']);
    Route::post('confirm', ConfirmUploadController::class);
});
