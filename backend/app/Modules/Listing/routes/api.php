<?php

use Illuminate\Support\Facades\Route;
use Modules\Listing\Http\Controllers\Api\V1\AiSuggestListingController;
use Modules\Listing\Http\Controllers\Api\V1\DestroyListingController;
use Modules\Listing\Http\Controllers\Api\V1\FavoriteListingsController;
use Modules\Listing\Http\Controllers\Api\V1\IndexListingsController;
use Modules\Listing\Http\Controllers\Api\V1\ListingFavoriteController;
use Modules\Listing\Http\Controllers\Api\V1\ListingStatusController;
use Modules\Listing\Http\Controllers\Api\V1\MyListingsController;
use Modules\Listing\Http\Controllers\Api\V1\ShowListingController;
use Modules\Listing\Http\Controllers\Api\V1\StoreListingController;
use Modules\Listing\Http\Controllers\Api\V1\UpdateListingController;

Route::get('listings', IndexListingsController::class);
Route::get('listings/{uuid}', ShowListingController::class)->where('uuid', '[0-9a-f-]{36}');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('users/me/listings', MyListingsController::class);
    Route::get('users/me/favorites', FavoriteListingsController::class);
    Route::post('listings', StoreListingController::class);
    Route::post('listings/ai-suggest', AiSuggestListingController::class);
    Route::patch('listings/{uuid}', UpdateListingController::class);
    Route::delete('listings/{uuid}', DestroyListingController::class);
    Route::post('listings/{uuid}/publish', [ListingStatusController::class, 'publish']);
    Route::post('listings/{uuid}/archive', [ListingStatusController::class, 'archive']);
    Route::post('listings/{uuid}/favorite', [ListingFavoriteController::class, 'store']);
    Route::delete('listings/{uuid}/favorite', [ListingFavoriteController::class, 'destroy']);
});
