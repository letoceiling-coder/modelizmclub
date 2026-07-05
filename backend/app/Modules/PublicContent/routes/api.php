<?php

use Illuminate\Support\Facades\Route;
use Modules\PublicContent\Http\Controllers\Api\V1\BannersController;
use Modules\PublicContent\Http\Controllers\Api\V1\FaqController;
use Modules\PublicContent\Http\Controllers\Api\V1\LandingStatsController;
use Modules\PublicContent\Http\Controllers\Api\V1\StatsController;

Route::prefix('public')->group(function (): void {
    Route::get('banners', BannersController::class);
    Route::get('faq', FaqController::class);
    Route::get('stats', StatsController::class);
    Route::get('landing-stats', LandingStatsController::class);
});
