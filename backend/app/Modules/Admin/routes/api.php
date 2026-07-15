<?php

use Illuminate\Support\Facades\Route;
use Modules\Admin\Http\Controllers\Api\V1\AdminDeliveryStatsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminIndexShipmentsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminShowShipmentController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUpdateShipmentController;
use Modules\Admin\Http\Controllers\Api\V1\AdminAuditLogController;
use Modules\Admin\Http\Controllers\Api\V1\AdminBannerController;
use Modules\Admin\Http\Controllers\Api\V1\AdminChannelApplicationsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminCommunityApplicationsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminIconAssetController;
use Modules\Admin\Http\Controllers\Api\V1\AdminIconMediaController;
use Modules\Admin\Http\Controllers\Api\V1\AdminCommunityCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminCommunityController;
use Modules\Admin\Http\Controllers\Api\V1\AdminDashboardController;
use Modules\Admin\Http\Controllers\Api\V1\AdminFeedbackController;
use Modules\Admin\Http\Controllers\Api\V1\AdminListingCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminListingController;
use Modules\Admin\Http\Controllers\Api\V1\AdminNotificationController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPlanController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPostCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPostController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPromocodeController;
use Modules\Admin\Http\Controllers\Api\V1\AdminSettingsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserPayoutRequisitesController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserController;
use Modules\Admin\Http\Controllers\Api\V1\ApproveModerationController;
use Modules\Admin\Http\Controllers\Api\V1\IndexModerationQueueController;
use Modules\Admin\Http\Controllers\Api\V1\IndexReportsController;
use Modules\Admin\Http\Controllers\Api\V1\RejectModerationController;
use Modules\Admin\Http\Controllers\Api\V1\ResolveReportController;
use Modules\Admin\Http\Controllers\Api\V1\RevisionModerationController;
use Modules\Admin\Http\Controllers\Api\V1\ShowReportController;

Route::prefix('admin')->middleware(['auth:sanctum'])->group(function (): void {
    Route::middleware('role:moderator,admin')->group(function (): void {
        Route::get('moderation/queue', IndexModerationQueueController::class);
        Route::post('moderation/{type}/{id}/approve', ApproveModerationController::class);
        Route::post('moderation/{type}/{id}/reject', RejectModerationController::class);
        Route::post('moderation/{type}/{id}/revision', RevisionModerationController::class);
        Route::get('reports', IndexReportsController::class);
        Route::get('reports/{id}', ShowReportController::class)->whereNumber('id');
        Route::patch('reports/{id}', ResolveReportController::class)->whereNumber('id');

        Route::get('feedback', [AdminFeedbackController::class, 'index']);
        Route::patch('feedback/{id}', [AdminFeedbackController::class, 'update'])->whereNumber('id');

        // Registered before the communities apiResource below so the literal
        // "applications" segment wins over the {slug} parameter.
        Route::get('communities/applications', [AdminCommunityApplicationsController::class, 'index']);
        Route::post('communities/applications/{id}/approve', [AdminCommunityApplicationsController::class, 'approve'])->whereNumber('id');
        Route::post('communities/applications/{id}/reject', [AdminCommunityApplicationsController::class, 'reject'])->whereNumber('id');

        Route::get('channels/applications', [AdminChannelApplicationsController::class, 'index']);
        Route::post('channels/applications/{id}/approve', [AdminChannelApplicationsController::class, 'approve'])->whereNumber('id');
        Route::post('channels/applications/{id}/reject', [AdminChannelApplicationsController::class, 'reject'])->whereNumber('id');
    });

    Route::middleware('role:admin')->group(function (): void {
        Route::get('dashboard', AdminDashboardController::class);

        Route::get('users/{id}/payout-requisites', AdminUserPayoutRequisitesController::class)->whereNumber('id');
        Route::apiResource('users', AdminUserController::class)->parameters(['users' => 'uuid']);

        Route::prefix('categories')->group(function (): void {
            Route::apiResource('post', AdminPostCategoryController::class);
            Route::apiResource('community', AdminCommunityCategoryController::class);
            Route::apiResource('listing', AdminListingCategoryController::class);
        });

        Route::get('posts', [AdminPostController::class, 'index']);
        Route::patch('posts/{uuid}', [AdminPostController::class, 'update']);
        Route::delete('posts/{uuid}', [AdminPostController::class, 'destroy']);

        Route::get('listings', [AdminListingController::class, 'index']);
        Route::patch('listings/{uuid}', [AdminListingController::class, 'update']);
        Route::delete('listings/{uuid}', [AdminListingController::class, 'destroy']);

        Route::apiResource('communities', AdminCommunityController::class)->parameters(['communities' => 'slug']);
        Route::apiResource('plans', AdminPlanController::class)->parameters(['plans' => 'slug']);
        Route::apiResource('promocodes', AdminPromocodeController::class)->parameters(['promocodes' => 'code']);
        Route::apiResource('banners', AdminBannerController::class);

        Route::post('notifications', AdminNotificationController::class);

        Route::get('audit-logs', AdminAuditLogController::class);

        Route::get('icon-assets', [AdminIconAssetController::class, 'index']);
        Route::post('icon-assets/from-media', [AdminIconAssetController::class, 'storeFromMedia']);
        Route::delete('icon-assets/{id}', [AdminIconAssetController::class, 'destroy'])->whereNumber('id');
        Route::get('icon-media', AdminIconMediaController::class);

        Route::prefix('delivery')->group(function (): void {
            Route::get('stats', AdminDeliveryStatsController::class);
            Route::get('shipments', AdminIndexShipmentsController::class);
            Route::get('shipments/{shipment}', AdminShowShipmentController::class);
            Route::patch('shipments/{shipment}', AdminUpdateShipmentController::class);
        });

        Route::get('settings', [AdminSettingsController::class, 'index']);
        Route::patch('settings', [AdminSettingsController::class, 'update']);
    });
});
