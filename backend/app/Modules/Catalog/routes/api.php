<?php

use Illuminate\Support\Facades\Route;
use Modules\Catalog\Http\Controllers\Api\V1\CitiesController;
use Modules\Catalog\Http\Controllers\Api\V1\CommunityCategoryTreeController;
use Modules\Catalog\Http\Controllers\Api\V1\ListingCategoryTreeController;
use Modules\Catalog\Http\Controllers\Api\V1\PostCategoryTreeController;
use Modules\Catalog\Http\Controllers\Api\V1\TagsController;

Route::prefix('categories')->group(function (): void {
    Route::get('posts', PostCategoryTreeController::class);
    Route::get('communities', CommunityCategoryTreeController::class);
    Route::get('listings', ListingCategoryTreeController::class);
});

Route::get('cities', CitiesController::class);
Route::get('tags', TagsController::class);
