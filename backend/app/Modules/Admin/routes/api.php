<?php

use Illuminate\Support\Facades\Route;
use Modules\Admin\Http\Controllers\Api\V1\AdminDeliveryMethodController;
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
use Modules\Admin\Http\Controllers\Api\V1\AdminMediaController;
use Modules\Admin\Http\Controllers\Api\V1\AdminCommunityCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminCommunityController;
use Modules\Admin\Http\Controllers\Api\V1\AdminDashboardController;
use Modules\Admin\Http\Controllers\Api\V1\AdminDiagnosticsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminFeedbackController;
use Modules\Admin\Http\Controllers\Api\V1\AdminDisputeController;
use Modules\Admin\Http\Controllers\Api\V1\AdminSafeDealController;
use Modules\Admin\Http\Controllers\Api\V1\AdminWalletController;
use Modules\Admin\Http\Controllers\Api\V1\AdminWithdrawalController;
use Modules\Admin\Http\Controllers\Api\V1\AdminFeedGuestAccessController;
use Modules\Admin\Http\Controllers\Api\V1\AdminFaqController;
use Modules\Admin\Http\Controllers\Api\V1\AdminFooterLinkController;
use Modules\Admin\Http\Controllers\Api\V1\AdminLegalPageController;
use Modules\Admin\Http\Controllers\Api\V1\AdminRulePageController;
use Modules\Admin\Http\Controllers\Api\V1\AdminLandingBlocksController;
use Modules\Admin\Http\Controllers\Api\V1\AdminListingCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminListingController;
use Modules\Admin\Http\Controllers\Api\V1\AdminNotificationController;
use Modules\Admin\Http\Controllers\Api\V1\AdminNotificationPolicyController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPlanController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPostCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPostController;
use Modules\Admin\Http\Controllers\Api\V1\AdminReferralController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPaymentsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPromocodeController;
use Modules\Admin\Http\Controllers\Api\V1\AdminSettingsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminVideoCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminVideoController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserPayoutRequisitesController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserSubscriptionController;
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
        Route::get('diagnostics', AdminDiagnosticsController::class);

        Route::get('users/{id}/payout-requisites', AdminUserPayoutRequisitesController::class)->whereNumber('id');
        Route::post('users/{uuid}/subscription', AdminUserSubscriptionController::class)->where('uuid', '[0-9a-f-]{36}');
        Route::apiResource('users', AdminUserController::class)->parameters(['users' => 'uuid']);

        Route::prefix('categories')->group(function (): void {
            Route::apiResource('post', AdminPostCategoryController::class);
            Route::apiResource('community', AdminCommunityCategoryController::class);
            Route::apiResource('listing', AdminListingCategoryController::class);
            Route::patch('video/reorder', [AdminVideoCategoryController::class, 'reorder']);
            Route::apiResource('video', AdminVideoCategoryController::class);
        });

        Route::get('videos', [AdminVideoController::class, 'index']);
        Route::get('videos/{uuid}', [AdminVideoController::class, 'show'])->where('uuid', '[0-9a-f-]{36}');
        Route::patch('videos/{uuid}', [AdminVideoController::class, 'update'])->where('uuid', '[0-9a-f-]{36}');
        Route::delete('videos/{uuid}', [AdminVideoController::class, 'destroy'])->where('uuid', '[0-9a-f-]{36}');

        Route::get('posts', [AdminPostController::class, 'index']);
        Route::patch('posts/{uuid}', [AdminPostController::class, 'update']);
        Route::delete('posts/{uuid}', [AdminPostController::class, 'destroy']);

        Route::get('listings', [AdminListingController::class, 'index']);
        Route::get('listings/{uuid}', [AdminListingController::class, 'show']);
        Route::patch('listings/{uuid}', [AdminListingController::class, 'update']);
        Route::delete('listings/{uuid}', [AdminListingController::class, 'destroy']);

        Route::apiResource('communities', AdminCommunityController::class)->parameters(['communities' => 'slug']);
        Route::apiResource('plans', AdminPlanController::class)->parameters(['plans' => 'slug']);
        Route::apiResource('promocodes', AdminPromocodeController::class)->parameters(['promocodes' => 'code']);
        Route::get('referrals', [AdminReferralController::class, 'index']);
        Route::get('promo-pools', [\Modules\Admin\Http\Controllers\Api\V1\AdminPromoPoolController::class, 'index']);
        Route::post('promo-pools', [\Modules\Admin\Http\Controllers\Api\V1\AdminPromoPoolController::class, 'store']);
        Route::post('promo-pools/{uuid}/pause', [\Modules\Admin\Http\Controllers\Api\V1\AdminPromoPoolController::class, 'pause'])
            ->where('uuid', '[0-9a-f-]{36}');
        Route::post('promo-pools/{uuid}/resume', [\Modules\Admin\Http\Controllers\Api\V1\AdminPromoPoolController::class, 'resume'])
            ->where('uuid', '[0-9a-f-]{36}');
        Route::post('promo-pools/{uuid}/complete', [\Modules\Admin\Http\Controllers\Api\V1\AdminPromoPoolController::class, 'complete'])
            ->where('uuid', '[0-9a-f-]{36}');
        Route::get('payments', [AdminPaymentsController::class, 'index']);
        Route::get('payments/export', [AdminPaymentsController::class, 'export']);
        Route::patch('banners/carousel/settings', [AdminBannerController::class, 'updateCarousel']);
        Route::apiResource('banners', AdminBannerController::class);

        Route::get('landing/blocks', [AdminLandingBlocksController::class, 'index']);
        Route::patch('landing/sections/{slug}', [AdminLandingBlocksController::class, 'updateSection']);
        Route::post('landing/cards', [AdminLandingBlocksController::class, 'storeCard']);
        Route::patch('landing/cards/reorder', [AdminLandingBlocksController::class, 'reorderCards']);
        Route::patch('landing/cards/{id}', [AdminLandingBlocksController::class, 'updateCard'])->whereNumber('id');
        Route::delete('landing/cards/{id}', [AdminLandingBlocksController::class, 'destroyCard'])->whereNumber('id');

        Route::get('feed/guest-access', [AdminFeedGuestAccessController::class, 'show']);
        Route::put('feed/guest-access', [AdminFeedGuestAccessController::class, 'update']);

        Route::get('notifications/policy', [AdminNotificationPolicyController::class, 'show']);
        Route::put('notifications/policy', [AdminNotificationPolicyController::class, 'update']);

        Route::post('notifications', AdminNotificationController::class);

        Route::get('audit-logs', AdminAuditLogController::class);

        Route::get('icon-assets', [AdminIconAssetController::class, 'index']);
        Route::post('icon-assets/from-media', [AdminIconAssetController::class, 'storeFromMedia']);
        Route::delete('icon-assets/{id}', [AdminIconAssetController::class, 'destroy'])->whereNumber('id');
        Route::get('icon-media', AdminIconMediaController::class);

        Route::get('media', [AdminMediaController::class, 'index']);
        Route::post('media', [AdminMediaController::class, 'store']);

        Route::prefix('delivery')->group(function (): void {
            Route::get('methods', [AdminDeliveryMethodController::class, 'index']);
            Route::patch('methods/{deliveryMethod}', [AdminDeliveryMethodController::class, 'update']);
            Route::post('methods/reorder', [AdminDeliveryMethodController::class, 'reorder']);
            Route::get('stats', AdminDeliveryStatsController::class);
            Route::get('shipments', AdminIndexShipmentsController::class);
            Route::get('shipments/{shipment}', AdminShowShipmentController::class);
            Route::patch('shipments/{shipment}', AdminUpdateShipmentController::class);
        });

        // Wallets, safe deals and disputes (spec v4.0 §T12).
        Route::get('wallets', [AdminWalletController::class, 'index']);
        Route::get('wallets/{uuid}', [AdminWalletController::class, 'show'])->where('uuid', '[0-9a-f-]{36}');
        Route::get('withdrawals', [AdminWithdrawalController::class, 'index']);
        Route::patch('withdrawals/{uuid}', [AdminWithdrawalController::class, 'update'])->where('uuid', '[0-9a-f-]{36}');
        Route::get('safe-deals', [AdminSafeDealController::class, 'index']);
        Route::get('safe-deals/export', [AdminSafeDealController::class, 'export']);
        Route::post('safe-deals/{uuid}/release', [AdminSafeDealController::class, 'release'])->where('uuid', '[0-9a-f-]{36}');
        Route::post('safe-deals/{uuid}/refund', [AdminSafeDealController::class, 'refund'])->where('uuid', '[0-9a-f-]{36}');
        Route::get('disputes', [AdminDisputeController::class, 'index']);
        Route::post('disputes/{uuid}/resolve', [AdminDisputeController::class, 'resolve'])->where('uuid', '[0-9a-f-]{36}');

        Route::get('settings', [AdminSettingsController::class, 'index']);
        Route::patch('settings', [AdminSettingsController::class, 'update']);

        Route::get('rule-pages', [AdminRulePageController::class, 'index']);
        Route::post('rule-pages', [AdminRulePageController::class, 'store']);
        Route::get('rule-pages/{id}', [AdminRulePageController::class, 'show'])->whereNumber('id');
        Route::put('rule-pages/{id}', [AdminRulePageController::class, 'update'])->whereNumber('id');
        Route::post('rule-pages/{id}/publish', [AdminRulePageController::class, 'publish'])->whereNumber('id');
        Route::post('rule-pages/{id}/duplicate', [AdminRulePageController::class, 'duplicate'])->whereNumber('id');
        Route::delete('rule-pages/{id}', [AdminRulePageController::class, 'destroy'])->whereNumber('id');
        Route::get('rule-pages/{id}/revisions', [AdminRulePageController::class, 'revisions'])->whereNumber('id');
        Route::post('rule-pages/{id}/revisions/{revisionId}/restore', [AdminRulePageController::class, 'restoreRevision'])
            ->whereNumber('id')
            ->whereNumber('revisionId');

        Route::get('legal-pages', [AdminLegalPageController::class, 'index']);
        Route::post('legal-pages', [AdminLegalPageController::class, 'store']);
        Route::post('legal-pages/preview-markdown', [AdminLegalPageController::class, 'previewMarkdown']);
        Route::get('legal-pages/{id}', [AdminLegalPageController::class, 'show'])->whereNumber('id');
        Route::put('legal-pages/{id}', [AdminLegalPageController::class, 'update'])->whereNumber('id');
        Route::post('legal-pages/{id}/publish', [AdminLegalPageController::class, 'publish'])->whereNumber('id');
        Route::post('legal-pages/{id}/archive', [AdminLegalPageController::class, 'archive'])->whereNumber('id');
        Route::get('legal-pages/{id}/revisions', [AdminLegalPageController::class, 'revisions'])->whereNumber('id');
        Route::post('legal-pages/{id}/revisions/{revisionId}/restore', [AdminLegalPageController::class, 'restoreRevision'])
            ->whereNumber('id')
            ->whereNumber('revisionId');

        Route::get('footer-links', [AdminFooterLinkController::class, 'index']);
        Route::post('footer-links', [AdminFooterLinkController::class, 'store']);
        Route::put('footer-links/{id}', [AdminFooterLinkController::class, 'update'])->whereNumber('id');
        Route::delete('footer-links/{id}', [AdminFooterLinkController::class, 'destroy'])->whereNumber('id');
        Route::post('footer-links/reorder', [AdminFooterLinkController::class, 'reorder']);

        Route::get('faq', [AdminFaqController::class, 'index']);
        Route::post('faq/categories', [AdminFaqController::class, 'storeCategory']);
        Route::patch('faq/categories/{id}', [AdminFaqController::class, 'updateCategory'])->whereNumber('id');
        Route::delete('faq/categories/{id}', [AdminFaqController::class, 'destroyCategory'])->whereNumber('id');
        Route::post('faq/articles', [AdminFaqController::class, 'storeArticle']);
        Route::patch('faq/articles/{id}', [AdminFaqController::class, 'updateArticle'])->whereNumber('id');
        Route::delete('faq/articles/{id}', [AdminFaqController::class, 'destroyArticle'])->whereNumber('id');
        Route::post('faq/articles/reorder', [AdminFaqController::class, 'reorderArticles']);
    });
});
