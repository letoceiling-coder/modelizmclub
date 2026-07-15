<?php

use Illuminate\Support\Facades\Route;
use Modules\PublicContent\Http\Controllers\Api\V1\BannersController;
use Modules\PublicContent\Http\Controllers\Api\V1\FaqController;
use Modules\PublicContent\Http\Controllers\Api\V1\FeatureFlagsController;
use Modules\PublicContent\Http\Controllers\Api\V1\IconOverridesController;
use Modules\PublicContent\Http\Controllers\Api\V1\LandingStatsController;
use Modules\PublicContent\Http\Controllers\Api\V1\StatsController;

Route::prefix('public')->group(function (): void {
    Route::get('banners', BannersController::class);
    Route::get('faq', FaqController::class);
    Route::get('stats', StatsController::class);
    Route::get('landing-stats', LandingStatsController::class);
    Route::get('feature-flags', FeatureFlagsController::class);
});

// Published icon slot overrides — public by design, mirrors feature-flags.
Route::get('icon-overrides', IconOverridesController::class);
