<?php

use Illuminate\Support\Facades\Route;
use Modules\PublicContent\Http\Controllers\Api\V1\BannersController;
use Modules\PublicContent\Http\Controllers\Api\V1\RecordBannerEventController;
use Modules\PublicContent\Http\Controllers\Api\V1\FeedGuestAccessController;
use Modules\PublicContent\Http\Controllers\Api\V1\FaqController;
use Modules\PublicContent\Http\Controllers\Api\V1\FeatureFlagsController;
use Modules\PublicContent\Http\Controllers\Api\V1\FooterContactsController;
use Modules\PublicContent\Http\Controllers\Api\V1\IconOverridesController;
use Modules\PublicContent\Http\Controllers\Api\V1\LandingBlocksController;
use Modules\PublicContent\Http\Controllers\Api\V1\LandingStatsController;
use Modules\PublicContent\Http\Controllers\Api\V1\StatsController;
use Modules\PublicContent\Http\Controllers\Api\V1\IndexDeliveryMethodsController;
use Modules\PublicContent\Http\Controllers\Api\V1\SiteBrandingController;

Route::prefix('public')->group(function (): void {
    Route::get('banners', BannersController::class);
    Route::post('banners/{id}/events', RecordBannerEventController::class)->whereNumber('id');
    Route::get('faq', FaqController::class);
    Route::get('stats', StatsController::class);
    Route::get('landing-blocks', LandingBlocksController::class);
    Route::get('landing-stats', LandingStatsController::class);
    Route::get('feature-flags', FeatureFlagsController::class);
    Route::get('feed-guest-access', FeedGuestAccessController::class);
    Route::get('footer-contacts', FooterContactsController::class);
    Route::get('branding', SiteBrandingController::class);
    Route::get('delivery-methods', IndexDeliveryMethodsController::class);
});

// Published icon slot overrides — public by design, mirrors feature-flags.
Route::get('icon-overrides', IconOverridesController::class);
