<?php

use Illuminate\Support\Facades\Route;
use Modules\Admin\Http\Controllers\Api\V1\AdminAccessController;
use Modules\Admin\Http\Controllers\Api\V1\AdminAuditLogController;
use Modules\Admin\Http\Controllers\Api\V1\AdminBannerController;
use Modules\Admin\Http\Controllers\Api\V1\AdminChannelApplicationsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminCommunityApplicationsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminCommunityCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminCommunityController;
use Modules\Admin\Http\Controllers\Api\V1\AdminDashboardController;
use Modules\Admin\Http\Controllers\Api\V1\AdminDeliveryMethodController;
use Modules\Admin\Http\Controllers\Api\V1\AdminDeliveryStatsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminDiagnosticsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminDisputeController;
use Modules\Admin\Http\Controllers\Api\V1\AdminEventsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminFaqController;
use Modules\Admin\Http\Controllers\Api\V1\AdminFeedbackController;
use Modules\Admin\Http\Controllers\Api\V1\AdminFeedGuestAccessController;
use Modules\Admin\Http\Controllers\Api\V1\AdminFooterLinkController;
use Modules\Admin\Http\Controllers\Api\V1\AdminIconAssetController;
use Modules\Admin\Http\Controllers\Api\V1\AdminIconMediaController;
use Modules\Admin\Http\Controllers\Api\V1\AdminIndexShipmentsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminLandingBlocksController;
use Modules\Admin\Http\Controllers\Api\V1\AdminLegalPageController;
use Modules\Admin\Http\Controllers\Api\V1\AdminListingCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminListingController;
use Modules\Admin\Http\Controllers\Api\V1\AdminMediaController;
use Modules\Admin\Http\Controllers\Api\V1\AdminNotificationController;
use Modules\Admin\Http\Controllers\Api\V1\AdminNotificationPolicyController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPaymentsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPlanController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPostCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPostController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPromocodeController;
use Modules\Admin\Http\Controllers\Api\V1\AdminPromoPoolController;
use Modules\Admin\Http\Controllers\Api\V1\AdminReferralController;
use Modules\Admin\Http\Controllers\Api\V1\AdminRulePageController;
use Modules\Admin\Http\Controllers\Api\V1\AdminSafeDealController;
use Modules\Admin\Http\Controllers\Api\V1\AdminSettingsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminShowShipmentController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUpdateShipmentController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserCategoriesController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserListingCreditsController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserPayoutRequisitesController;
use Modules\Admin\Http\Controllers\Api\V1\AdminUserSubscriptionController;
use Modules\Admin\Http\Controllers\Api\V1\AdminVideoCategoryController;
use Modules\Admin\Http\Controllers\Api\V1\AdminVideoController;
use Modules\Admin\Http\Controllers\Api\V1\AdminWalletController;
use Modules\Admin\Http\Controllers\Api\V1\AdminWithdrawalController;
use Modules\Admin\Http\Controllers\Api\V1\ApproveModerationController;
use Modules\Admin\Http\Controllers\Api\V1\IndexModerationQueueController;
use Modules\Admin\Http\Controllers\Api\V1\IndexReportsController;
use Modules\Admin\Http\Controllers\Api\V1\RejectModerationController;
use Modules\Admin\Http\Controllers\Api\V1\ResolveReportController;
use Modules\Admin\Http\Controllers\Api\V1\RevisionModerationController;
use Modules\Admin\Http\Controllers\Api\V1\ShowReportController;

Route::prefix('admin')->middleware(['auth:sanctum'])->group(function (): void {
    /*
     * Разделы по карте App\Support\AdminAccess — одна карта на маршруты и
     * меню (GET admin/access). До 17.09 здесь были группы role:moderator,admin
     * и role:admin, а меню держало свой список, и они расходились.
     */
    Route::get('access', AdminAccessController::class);

    Route::middleware('admin.section:moderation')->group(function (): void {
        Route::get('moderation/queue', IndexModerationQueueController::class);
        Route::post('moderation/{type}/{id}/approve', ApproveModerationController::class);
        Route::post('moderation/{type}/{id}/reject', RejectModerationController::class);
        Route::post('moderation/{type}/{id}/revision', RevisionModerationController::class);
    });

    // Жалобы — часть раздела модерации, но не для администратора
    // направления: жалоба бывает на что угодно, не только на его ветку.
    Route::middleware('admin.section:reports')->group(function (): void {
        Route::get('reports', IndexReportsController::class);
        Route::get('reports/{id}', ShowReportController::class)->whereNumber('id');
        Route::patch('reports/{id}', ResolveReportController::class)->whereNumber('id');
    });

    Route::middleware('admin.section:feedback')->group(function (): void {
        Route::get('feedback', [AdminFeedbackController::class, 'index']);
        Route::patch('feedback/{id}', [AdminFeedbackController::class, 'update'])->whereNumber('id');
    });

    Route::middleware('admin.section:applications')->group(function (): void {
        // "applications" segment wins over the {slug} parameter.
        Route::get('communities/applications', [AdminCommunityApplicationsController::class, 'index']);
        Route::post('communities/applications/{id}/approve', [AdminCommunityApplicationsController::class, 'approve'])->whereNumber('id');
        Route::post('communities/applications/{id}/reject', [AdminCommunityApplicationsController::class, 'reject'])->whereNumber('id');
        Route::get('channels/applications', [AdminChannelApplicationsController::class, 'index']);
        Route::post('channels/applications/{id}/approve', [AdminChannelApplicationsController::class, 'approve'])->whereNumber('id');
        Route::post('channels/applications/{id}/reject', [AdminChannelApplicationsController::class, 'reject'])->whereNumber('id');
    });

    Route::middleware('admin.section:users')->group(function (): void {
        // Модератор: список, карточка, правка статуса и имени обычных
        // пользователей. Роль, почту, пароль и сотрудников — Владелец
        // (AdminUserController::guardModeratorEdit).
        Route::apiResource('users', AdminUserController::class)->parameters(['users' => 'uuid'])->only(['index', 'show', 'update']);
    });

    Route::middleware('admin.section:content')->group(function (): void {
        Route::get('posts', [AdminPostController::class, 'index']);
        Route::patch('posts/{uuid}', [AdminPostController::class, 'update']);
        Route::delete('posts/{uuid}', [AdminPostController::class, 'destroy'])->middleware('admin.section:posts.delete');
    });

    Route::middleware('admin.section:ads')->group(function (): void {
        Route::get('listings', [AdminListingController::class, 'index']);
        Route::get('listings/{uuid}', [AdminListingController::class, 'show']);
        Route::patch('listings/{uuid}', [AdminListingController::class, 'update']);
        Route::delete('listings/{uuid}', [AdminListingController::class, 'destroy'])->middleware('admin.section:listings.delete');
    });

    Route::middleware('admin.section:delivery')->group(function (): void {
        Route::prefix('delivery')->group(function (): void {
            Route::get('methods', [AdminDeliveryMethodController::class, 'index']);
            Route::patch('methods/{deliveryMethod}', [AdminDeliveryMethodController::class, 'update']);
            Route::post('methods/reorder', [AdminDeliveryMethodController::class, 'reorder']);
            Route::get('stats', AdminDeliveryStatsController::class);
            Route::get('shipments', AdminIndexShipmentsController::class);
            Route::get('shipments/{shipment}', AdminShowShipmentController::class);
            Route::patch('shipments/{shipment}', AdminUpdateShipmentController::class);
        });
    });

    Route::middleware('admin.section:categories')->group(function (): void {
        // Цены размещения в строке категории — только Владелец
        // (AdminPostCategoryController::guardOwnerOnlyFields).
        Route::prefix('categories')->group(function (): void {
            Route::apiResource('post', AdminPostCategoryController::class);
            Route::apiResource('community', AdminCommunityCategoryController::class);
            Route::apiResource('listing', AdminListingCategoryController::class);
        });
    });

    // Дальше — по разделу на группу; минимальная роль раздела объявлена в
    // App\Support\AdminAccess (SECTIONS и SERVICE). До 19.09 всё это лежало
    // одной группой `admin.section:owner`. Порядок регистрации сохранён.

    Route::middleware('admin.section:users.manage')->group(function (): void {
        Route::apiResource('users', AdminUserController::class)->parameters(['users' => 'uuid'])->only(['store', 'destroy']);
    });

    Route::middleware('admin.section:dashboard.full')->group(function (): void {
        Route::get('dashboard', AdminDashboardController::class);
    });

    Route::middleware('admin.section:diagnostics')->group(function (): void {
        Route::get('diagnostics', AdminDiagnosticsController::class);
    });

    Route::middleware('admin.section:users.manage')->group(function (): void {
        Route::get('users/{id}/payout-requisites', AdminUserPayoutRequisitesController::class)->whereNumber('id');
        Route::post('users/{uuid}/subscription', AdminUserSubscriptionController::class)->where('uuid', '[0-9a-f-]{36}');
        Route::post('users/{uuid}/listing-credits', AdminUserListingCreditsController::class)->where('uuid', '[0-9a-f-]{36}');
        Route::get('users/{uuid}/categories', [AdminUserCategoriesController::class, 'show'])->where('uuid', '[0-9a-f-]{36}');
        Route::put('users/{uuid}/categories', [AdminUserCategoriesController::class, 'update'])->where('uuid', '[0-9a-f-]{36}');
    });

    Route::middleware('admin.section:reviewCategories')->group(function (): void {
        Route::prefix('categories')->group(function (): void {
            Route::patch('video/reorder', [AdminVideoCategoryController::class, 'reorder']);
            Route::apiResource('video', AdminVideoCategoryController::class);
        });
    });

    Route::middleware('admin.section:reviews')->group(function (): void {
        Route::get('videos', [AdminVideoController::class, 'index']);
        Route::get('videos/{uuid}', [AdminVideoController::class, 'show'])->where('uuid', '[0-9a-f-]{36}');
        Route::patch('videos/{uuid}', [AdminVideoController::class, 'update'])->where('uuid', '[0-9a-f-]{36}');
        Route::delete('videos/{uuid}', [AdminVideoController::class, 'destroy'])->where('uuid', '[0-9a-f-]{36}');
    });

    Route::middleware('admin.section:communities')->group(function (): void {
        Route::apiResource('communities', AdminCommunityController::class)->parameters(['communities' => 'slug']);
    });

    Route::middleware('admin.section:monetization')->group(function (): void {
        Route::apiResource('plans', AdminPlanController::class)->parameters(['plans' => 'slug']);
        Route::apiResource('promocodes', AdminPromocodeController::class)->parameters(['promocodes' => 'code']);
        Route::get('referrals', [AdminReferralController::class, 'index']);
        Route::get('promo-pools', [AdminPromoPoolController::class, 'index']);
        Route::post('promo-pools', [AdminPromoPoolController::class, 'store']);
        Route::post('promo-pools/{uuid}/pause', [AdminPromoPoolController::class, 'pause'])
            ->where('uuid', '[0-9a-f-]{36}');
        Route::post('promo-pools/{uuid}/resume', [AdminPromoPoolController::class, 'resume'])
            ->where('uuid', '[0-9a-f-]{36}');
        Route::post('promo-pools/{uuid}/complete', [AdminPromoPoolController::class, 'complete'])
            ->where('uuid', '[0-9a-f-]{36}');
        Route::get('payments', [AdminPaymentsController::class, 'index']);
        Route::get('payments/export', [AdminPaymentsController::class, 'export']);
    });

    Route::middleware('admin.section:feedBanners')->group(function (): void {
        Route::patch('banners/carousel/settings', [AdminBannerController::class, 'updateCarousel']);
        Route::apiResource('banners', AdminBannerController::class);
    });

    Route::middleware('admin.section:events')->group(function (): void {
        Route::get('events', [AdminEventsController::class, 'index']);
        Route::post('events', [AdminEventsController::class, 'store']);
        Route::patch('events/{uuid}', [AdminEventsController::class, 'update'])->whereUuid('uuid');
        Route::delete('events/{uuid}', [AdminEventsController::class, 'destroy'])->whereUuid('uuid');
        Route::post('events/{uuid}/cancel', [AdminEventsController::class, 'cancel'])->whereUuid('uuid');
        Route::get('events/{uuid}/attendees', [AdminEventsController::class, 'attendees'])->whereUuid('uuid');
    });

    Route::middleware('admin.section:landingBlocks')->group(function (): void {
        Route::get('landing/blocks', [AdminLandingBlocksController::class, 'index']);
        Route::patch('landing/sections/{slug}', [AdminLandingBlocksController::class, 'updateSection']);
        Route::post('landing/cards', [AdminLandingBlocksController::class, 'storeCard']);
        Route::patch('landing/cards/reorder', [AdminLandingBlocksController::class, 'reorderCards']);
        Route::patch('landing/cards/{id}', [AdminLandingBlocksController::class, 'updateCard'])->whereNumber('id');
        Route::delete('landing/cards/{id}', [AdminLandingBlocksController::class, 'destroyCard'])->whereNumber('id');
    });

    Route::middleware('admin.section:feedGuestAccess')->group(function (): void {
        Route::get('feed/guest-access', [AdminFeedGuestAccessController::class, 'show']);
        Route::put('feed/guest-access', [AdminFeedGuestAccessController::class, 'update']);
    });

    Route::middleware('admin.section:notificationPolicy')->group(function (): void {
        Route::get('notifications/policy', [AdminNotificationPolicyController::class, 'show']);
        Route::put('notifications/policy', [AdminNotificationPolicyController::class, 'update']);
    });

    Route::middleware('admin.section:notifications')->group(function (): void {
        Route::post('notifications', AdminNotificationController::class);
    });

    Route::middleware('admin.section:auditLog')->group(function (): void {
        Route::get('audit-logs', AdminAuditLogController::class);
    });

    Route::middleware('admin.section:icons')->group(function (): void {
        Route::get('icon-assets', [AdminIconAssetController::class, 'index']);
        Route::post('icon-assets/from-media', [AdminIconAssetController::class, 'storeFromMedia']);
        Route::delete('icon-assets/{id}', [AdminIconAssetController::class, 'destroy'])->whereNumber('id');
        Route::get('icon-media', AdminIconMediaController::class);
    });

    // Библиотека медиа — раздел модератора; ею же пользуются карточки
    // иконок, баннеров и лендинга у Владельца.
    Route::middleware('admin.section:media')->group(function (): void {
        Route::get('media', [AdminMediaController::class, 'index']);
        Route::post('media', [AdminMediaController::class, 'store']);
    });

    Route::middleware('admin.section:monetization')->group(function (): void {
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
    });

    Route::middleware('admin.section:settings')->group(function (): void {
        Route::get('settings', [AdminSettingsController::class, 'index']);
        Route::patch('settings', [AdminSettingsController::class, 'update']);
    });

    Route::middleware('admin.section:rulesPages')->group(function (): void {
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
    });

    Route::middleware('admin.section:legalPages')->group(function (): void {
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
    });

    Route::middleware('admin.section:footerLinks')->group(function (): void {
        Route::get('footer-links', [AdminFooterLinkController::class, 'index']);
        Route::post('footer-links', [AdminFooterLinkController::class, 'store']);
        Route::put('footer-links/{id}', [AdminFooterLinkController::class, 'update'])->whereNumber('id');
        Route::delete('footer-links/{id}', [AdminFooterLinkController::class, 'destroy'])->whereNumber('id');
        Route::post('footer-links/reorder', [AdminFooterLinkController::class, 'reorder']);
    });

    // Вопросы и ответы редактируются в разделе «Главная страница».
    Route::middleware('admin.section:landingBlocks')->group(function (): void {
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
