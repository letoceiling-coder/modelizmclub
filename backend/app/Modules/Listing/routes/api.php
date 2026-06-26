<?php

use Illuminate\Support\Facades\Route;
use Modules\Listing\Http\Controllers\Api\V1\IndexListingsController;
use Modules\Listing\Http\Controllers\Api\V1\MyListingsController;
use Modules\Listing\Http\Controllers\Api\V1\ShowListingController;
use Modules\Listing\Http\Controllers\Api\V1\StoreListingController;

Route::get('listings', IndexListingsController::class);
Route::get('listings/{uuid}', ShowListingController::class);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('users/me/listings', MyListingsController::class);
    Route::post('listings', StoreListingController::class);
});
