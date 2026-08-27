<?php

use Illuminate\Support\Facades\Route;
use Modules\Legal\Http\Controllers\Api\V1\DestroyMyAccountController;
use Modules\Legal\Http\Controllers\Api\V1\ExportMyDataController;
use Modules\Legal\Http\Controllers\Api\V1\FooterLinksController;
use Modules\Legal\Http\Controllers\Api\V1\IndexMyConsentsController;
use Modules\Legal\Http\Controllers\Api\V1\RevokeConsentController;
use Modules\Legal\Http\Controllers\Api\V1\IndexRulePagesController;
use Modules\Legal\Http\Controllers\Api\V1\ShowLegalPageController;
use Modules\Legal\Http\Controllers\Api\V1\ShowRulePageController;
use Modules\Legal\Http\Controllers\Api\V1\StoreCookiePreferencesController;

Route::get('legal/{slug}', ShowLegalPageController::class)->where('slug', '[a-z0-9-]+');
Route::get('rules', IndexRulePagesController::class);
Route::get('rules/{slug}', ShowRulePageController::class)->where('slug', '[a-z0-9-]+');
Route::get('footer-links', FooterLinksController::class);
Route::post('cookie-preferences', StoreCookiePreferencesController::class);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('me/consents', IndexMyConsentsController::class);
    Route::post('consents/{type}/revoke', RevokeConsentController::class);
    Route::get('me/data/export', ExportMyDataController::class);
    Route::delete('me', DestroyMyAccountController::class);
});
