# 21 — Маршруты API

> **Снимок 13.09.2026, прод на `eb767d8c`.** Собран скриптом
> `deploy/scripts/context-routes-api.py` из `php artisan route:list --json`
> боевого сервера — пересобирайте им же, руками не правьте.
> Числа про авторизацию посчитаны по `backend/app` на `eb767d8c`.

Маршрутов под префиксом `/api` — **443** (так считает `route:list`).
В таблице **455** строк: маршрут с несколькими методами (`PUT|PATCH`, `GET|POST`)
разложен по методу на строку, HEAD не показан. Изменяющих строк — **281**,
под `auth:sanctum` — **370**.

## Как устроена авторизация — читать до таблицы

Доступ к маршруту решает middleware: вход (`auth:sanctum`), подтверждённый номер
(`EnsureFullyVerified`), подписка (`RequiresSubscription`), роль (`EnsureUserRole`).
Право на конкретный объект — владелец, участник — проверяется внутри: в policy,
в контроллере или в сервисе. По таблице маршрутов это не видно.

| Middleware | Маршрутов |
|---|---:|
| `auth:sanctum` | 370 |
| `EnsureUserRole:admin` | 147 |
| `EnsureFullyVerified` | 126 |
| `ResolveOptionalUser` | 40 |
| `EnsureCommunitiesEnabled` | 24 |
| `EnsureUserRole:moderator,admin` | 15 |
| `RequiresSubscription` | 5 |
| `ThrottleRequests:auth-max-start` | 3 |
| `ThrottleRequests:30,1` | 1 |
| `ThrottleRequests:60,1` | 1 |
| `ThrottleRequests:auth-forgot-password` | 1 |
| `ThrottleRequests:auth-login` | 1 |
| `ThrottleRequests:auth-max-status` | 1 |
| `ThrottleRequests:auth-phone-send` | 1 |
| `ThrottleRequests:auth-phone-verify` | 1 |
| `ThrottleRequests:auth-register` | 1 |
| `ThrottleRequests:auth-reset-password` | 1 |
| `ThrottleRequests:auth-verify` | 1 |

| Проверки объекта в `backend/app` | Найдено |
|---|---:|
| Policy-классов (`*/Policies/*Policy.php`) | 8 |
| Регистраций `Gate::policy` | 8 |
| Вызовов `Gate::` всего | 14 |
| `->can(` / `->cannot(` | 15 |
| `authorize(` в контроллерах | 40 |
| `abort_if` / `abort_unless` | 0 |

Policy-классы: `backend/app/Policies/CommentPolicy.php`, `backend/app/Policies/CommunityPolicy.php`, `backend/app/Policies/ConversationPolicy.php`, `backend/app/Policies/DisputePolicy.php`, `backend/app/Policies/ListingPolicy.php`, `backend/app/Policies/MessagePolicy.php`, `backend/app/Policies/PostPolicy.php`, `backend/app/Policies/SafeDealPolicy.php`.

Изменяющих строк без `auth:sanctum` — **23**. Все маршруты группы `api`
дополнительно проходят общий лимит частоты; отдельный лимит и проверка подписи
вебхука, если они есть, — в столбце «Middleware» и в контроллере.

| Метод | URI | Контроллер | Middleware |
|---|---|---|---|
| POST | `/api/v1/auth/forgot-password` | `ForgotPasswordController` | ThrottleRequests:auth-forgot-password |
| POST | `/api/v1/auth/login` | `LoginController` | ThrottleRequests:auth-login |
| POST | `/api/v1/auth/oauth/max/start` | `MaxAuthController@start` | ThrottleRequests:auth-max-start |
| POST | `/api/v1/auth/register` | `RegisterController` | ThrottleRequests:auth-register |
| POST | `/api/v1/auth/reset-password` | `ResetPasswordController` | ThrottleRequests:auth-reset-password |
| POST | `/api/v1/auth/verify-email` | `VerifyEmailController` | ThrottleRequests:auth-verify |
| POST | `/api/v1/channels/{slug}/posts/{postUuid}/view` | `ChannelController@view` | ResolveOptionalUser |
| POST | `/api/v1/cookie-preferences` | `StoreCookiePreferencesController` | — |
| POST | `/api/v1/csp-report` | `CspReportController` | ThrottleRequests:60,1 |
| POST | `/api/v1/delivery/cdek/quote` | `CdekQuoteController` | — |
| POST | `/api/v1/delivery/yandex/location/detect` | `YandexDetectLocationController` | — |
| POST | `/api/v1/delivery/yandex/quote` | `YandexQuoteController` | — |
| POST | `/api/v1/feedback` | `FeedbackController@store` | — |
| POST | `/api/v1/payments/webhooks/vtb` | `VtbWebhookController` | — |
| POST | `/api/v1/public/banners/{id}/events` | `RecordBannerEventController` | — |
| POST | `/api/v1/public/referrals/click` | `TrackReferralClickController` | — |
| POST | `/api/v1/safe-deals/webhooks/delivery` | `SafeDealDeliveryWebhookController` | — |
| POST | `/api/v1/safe-deals/webhooks/vtb` | `SafeDealVtbWebhookController` | — |
| POST | `/api/v1/safe-deals/webhooks/vtb-payout` | `SafeDealPayoutWebhookController` | — |
| POST | `/api/v1/videos/{uuid}/view` | `VideoViewController` | ResolveOptionalUser |
| POST | `/api/v1/webhooks/cdek/order-status` | `CdekOrderStatusWebhookController` | — |
| POST | `/api/v1/webhooks/max` | `MaxWebhookController` | — |
| POST | `/api/v1/webhooks/yandex/delivery-status` | `YandexDeliveryStatusWebhookController` | — |

## Полный список

Изменяющие маршруты помечены ✎.

| | Метод | URI | Контроллер | Middleware |
|---|---|---|---|---|
| ✎ | POST | `/api/v1/account/2fa/disable` | `DisableTwoFactorController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/account/2fa/setup` | `SetupTwoFactorController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/account/2fa/verify` | `VerifyTwoFactorController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/account/change-email` | `ChangeEmailController` | auth:sanctum |
| ✎ | POST | `/api/v1/account/change-password` | `ChangePasswordController` | auth:sanctum |
| ✎ | POST | `/api/v1/account/confirm-email` | `ConfirmEmailChangeController` | auth:sanctum |
| ✎ | POST | `/api/v1/account/email` | `ChangeEmailController` | auth:sanctum |
| ✎ | POST | `/api/v1/account/email/verify/resend` | `ResendEmailChangeController` | auth:sanctum |
|  | GET | `/api/v1/account/payment-methods` | `IndexPaymentMethodsController` | auth:sanctum |
| ✎ | POST | `/api/v1/account/payment-methods` | `StorePaymentMethodController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/account/payment-methods/bind/complete` | `CompleteCardBindingController` | — |
| ✎ | DELETE | `/api/v1/account/payment-methods/{id}` | `DestroyPaymentMethodController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/account/payout-requisites` | `ShowPayoutRequisitesController` | auth:sanctum |
| ✎ | PUT | `/api/v1/account/payout-requisites` | `UpdatePayoutRequisitesController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/account/phone/send-code` | `SendPhoneVerificationCodeController` | auth:sanctum,ThrottleRequests:auth-phone-send |
| ✎ | POST | `/api/v1/account/phone/verify` | `VerifyPhoneController` | auth:sanctum,ThrottleRequests:auth-phone-verify |
|  | GET | `/api/v1/account/requisites` | `ShowDocumentRequisitesController` | auth:sanctum |
| ✎ | PUT | `/api/v1/account/requisites` | `UpdateDocumentRequisitesController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/account/resend-verification-email` | `ResendVerificationEmailController` | auth:sanctum |
|  | GET | `/api/v1/admin/audit-logs` | `AdminAuditLogController` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/banners` | `AdminBannerController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/banners` | `AdminBannerController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/banners/carousel/settings` | `AdminBannerController@updateCarousel` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/banners/{banner}` | `AdminBannerController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/banners/{banner}` | `AdminBannerController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/banners/{banner}` | `AdminBannerController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/banners/{banner}` | `AdminBannerController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/categories/community` | `AdminCommunityCategoryController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/categories/community` | `AdminCommunityCategoryController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/categories/community/{community}` | `AdminCommunityCategoryController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/categories/community/{community}` | `AdminCommunityCategoryController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/categories/community/{community}` | `AdminCommunityCategoryController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/categories/community/{community}` | `AdminCommunityCategoryController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/categories/listing` | `AdminListingCategoryController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/categories/listing` | `AdminListingCategoryController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/categories/listing/{listing}` | `AdminListingCategoryController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/categories/listing/{listing}` | `AdminListingCategoryController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/categories/listing/{listing}` | `AdminListingCategoryController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/categories/listing/{listing}` | `AdminListingCategoryController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/categories/post` | `AdminPostCategoryController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/categories/post` | `AdminPostCategoryController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/categories/post/{post}` | `AdminPostCategoryController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/categories/post/{post}` | `AdminPostCategoryController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/categories/post/{post}` | `AdminPostCategoryController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/categories/post/{post}` | `AdminPostCategoryController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/categories/video` | `AdminVideoCategoryController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/categories/video` | `AdminVideoCategoryController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/categories/video/reorder` | `AdminVideoCategoryController@reorder` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/categories/video/{video}` | `AdminVideoCategoryController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/categories/video/{video}` | `AdminVideoCategoryController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/categories/video/{video}` | `AdminVideoCategoryController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/categories/video/{video}` | `AdminVideoCategoryController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/channels/applications` | `AdminChannelApplicationsController@index` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | POST | `/api/v1/admin/channels/applications/{id}/approve` | `AdminChannelApplicationsController@approve` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | POST | `/api/v1/admin/channels/applications/{id}/reject` | `AdminChannelApplicationsController@reject` | auth:sanctum,EnsureUserRole:moderator,admin |
|  | GET | `/api/v1/admin/communities` | `AdminCommunityController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/communities` | `AdminCommunityController@store` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/communities/applications` | `AdminCommunityApplicationsController@index` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | POST | `/api/v1/admin/communities/applications/{id}/approve` | `AdminCommunityApplicationsController@approve` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | POST | `/api/v1/admin/communities/applications/{id}/reject` | `AdminCommunityApplicationsController@reject` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | DELETE | `/api/v1/admin/communities/{slug}` | `AdminCommunityController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/communities/{slug}` | `AdminCommunityController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/communities/{slug}` | `AdminCommunityController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/communities/{slug}` | `AdminCommunityController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/dashboard` | `AdminDashboardController` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/delivery/methods` | `AdminDeliveryMethodController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/delivery/methods/reorder` | `AdminDeliveryMethodController@reorder` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/delivery/methods/{deliveryMethod}` | `AdminDeliveryMethodController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/delivery/shipments` | `AdminIndexShipmentsController` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/delivery/shipments/{shipment}` | `AdminShowShipmentController` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/delivery/shipments/{shipment}` | `AdminUpdateShipmentController` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/delivery/stats` | `AdminDeliveryStatsController` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/diagnostics` | `AdminDiagnosticsController` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/disputes` | `AdminDisputeController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/disputes/{uuid}/resolve` | `AdminDisputeController@resolve` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/faq` | `AdminFaqController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/faq/articles` | `AdminFaqController@storeArticle` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/faq/articles/reorder` | `AdminFaqController@reorderArticles` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/faq/articles/{id}` | `AdminFaqController@destroyArticle` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/faq/articles/{id}` | `AdminFaqController@updateArticle` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/faq/categories` | `AdminFaqController@storeCategory` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/faq/categories/{id}` | `AdminFaqController@destroyCategory` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/faq/categories/{id}` | `AdminFaqController@updateCategory` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/feed/guest-access` | `AdminFeedGuestAccessController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/feed/guest-access` | `AdminFeedGuestAccessController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/feedback` | `AdminFeedbackController@index` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | PATCH | `/api/v1/admin/feedback/{id}` | `AdminFeedbackController@update` | auth:sanctum,EnsureUserRole:moderator,admin |
|  | GET | `/api/v1/admin/footer-links` | `AdminFooterLinkController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/footer-links` | `AdminFooterLinkController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/footer-links/reorder` | `AdminFooterLinkController@reorder` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/footer-links/{id}` | `AdminFooterLinkController@destroy` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/footer-links/{id}` | `AdminFooterLinkController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/icon-assets` | `AdminIconAssetController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/icon-assets/from-media` | `AdminIconAssetController@storeFromMedia` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/icon-assets/{id}` | `AdminIconAssetController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/icon-media` | `AdminIconMediaController` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/landing/blocks` | `AdminLandingBlocksController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/landing/cards` | `AdminLandingBlocksController@storeCard` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/landing/cards/reorder` | `AdminLandingBlocksController@reorderCards` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/landing/cards/{id}` | `AdminLandingBlocksController@destroyCard` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/landing/cards/{id}` | `AdminLandingBlocksController@updateCard` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/landing/sections/{slug}` | `AdminLandingBlocksController@updateSection` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/legal-pages` | `AdminLegalPageController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/legal-pages` | `AdminLegalPageController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/legal-pages/preview-markdown` | `AdminLegalPageController@previewMarkdown` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/legal-pages/{id}` | `AdminLegalPageController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/legal-pages/{id}` | `AdminLegalPageController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/legal-pages/{id}/archive` | `AdminLegalPageController@archive` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/legal-pages/{id}/publish` | `AdminLegalPageController@publish` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/legal-pages/{id}/revisions` | `AdminLegalPageController@revisions` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/legal-pages/{id}/revisions/{revisionId}/restore` | `AdminLegalPageController@restoreRevision` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/listings` | `AdminListingController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/listings/{uuid}` | `AdminListingController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/listings/{uuid}` | `AdminListingController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/listings/{uuid}` | `AdminListingController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/media` | `AdminMediaController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/media` | `AdminMediaController@store` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/moderation/queue` | `IndexModerationQueueController` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | POST | `/api/v1/admin/moderation/{type}/{id}/approve` | `ApproveModerationController` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | POST | `/api/v1/admin/moderation/{type}/{id}/reject` | `RejectModerationController` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | POST | `/api/v1/admin/moderation/{type}/{id}/revision` | `RevisionModerationController` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | POST | `/api/v1/admin/notifications` | `AdminNotificationController` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/notifications/policy` | `AdminNotificationPolicyController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/notifications/policy` | `AdminNotificationPolicyController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/payments` | `AdminPaymentsController@index` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/payments/export` | `AdminPaymentsController@export` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/plans` | `AdminPlanController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/plans` | `AdminPlanController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/plans/{slug}` | `AdminPlanController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/plans/{slug}` | `AdminPlanController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/plans/{slug}` | `AdminPlanController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/plans/{slug}` | `AdminPlanController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/posts` | `AdminPostController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/posts/{uuid}` | `AdminPostController@destroy` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/posts/{uuid}` | `AdminPostController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/promo-pools` | `AdminPromoPoolController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/promo-pools` | `AdminPromoPoolController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/promo-pools/{uuid}/complete` | `AdminPromoPoolController@complete` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/promo-pools/{uuid}/pause` | `AdminPromoPoolController@pause` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/promo-pools/{uuid}/resume` | `AdminPromoPoolController@resume` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/promocodes` | `AdminPromocodeController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/promocodes` | `AdminPromocodeController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/promocodes/{code}` | `AdminPromocodeController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/promocodes/{code}` | `AdminPromocodeController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/promocodes/{code}` | `AdminPromocodeController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/promocodes/{code}` | `AdminPromocodeController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/referrals` | `AdminReferralController@index` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/reports` | `IndexReportsController` | auth:sanctum,EnsureUserRole:moderator,admin |
|  | GET | `/api/v1/admin/reports/{id}` | `ShowReportController` | auth:sanctum,EnsureUserRole:moderator,admin |
| ✎ | PATCH | `/api/v1/admin/reports/{id}` | `ResolveReportController` | auth:sanctum,EnsureUserRole:moderator,admin |
|  | GET | `/api/v1/admin/rule-pages` | `AdminRulePageController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/rule-pages` | `AdminRulePageController@store` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/rule-pages/{id}` | `AdminRulePageController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/rule-pages/{id}` | `AdminRulePageController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/rule-pages/{id}` | `AdminRulePageController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/rule-pages/{id}/duplicate` | `AdminRulePageController@duplicate` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/rule-pages/{id}/publish` | `AdminRulePageController@publish` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/rule-pages/{id}/revisions` | `AdminRulePageController@revisions` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/rule-pages/{id}/revisions/{revisionId}/restore` | `AdminRulePageController@restoreRevision` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/safe-deals` | `AdminSafeDealController@index` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/safe-deals/export` | `AdminSafeDealController@export` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/safe-deals/{uuid}/refund` | `AdminSafeDealController@refund` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/safe-deals/{uuid}/release` | `AdminSafeDealController@release` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/settings` | `AdminSettingsController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/settings` | `AdminSettingsController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/users` | `AdminUserController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/users` | `AdminUserController@store` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/users/{id}/payout-requisites` | `AdminUserPayoutRequisitesController` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/users/{uuid}` | `AdminUserController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/users/{uuid}` | `AdminUserController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/users/{uuid}` | `AdminUserController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PUT | `/api/v1/admin/users/{uuid}` | `AdminUserController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/admin/users/{uuid}/subscription` | `AdminUserSubscriptionController` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/videos` | `AdminVideoController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | DELETE | `/api/v1/admin/videos/{uuid}` | `AdminVideoController@destroy` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/videos/{uuid}` | `AdminVideoController@show` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/videos/{uuid}` | `AdminVideoController@update` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/wallets` | `AdminWalletController@index` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/wallets/{uuid}` | `AdminWalletController@show` | auth:sanctum,EnsureUserRole:admin |
|  | GET | `/api/v1/admin/withdrawals` | `AdminWithdrawalController@index` | auth:sanctum,EnsureUserRole:admin |
| ✎ | PATCH | `/api/v1/admin/withdrawals/{uuid}` | `AdminWithdrawalController@update` | auth:sanctum,EnsureUserRole:admin |
| ✎ | POST | `/api/v1/auth/consent` | `ConsentController` | auth:sanctum |
| ✎ | POST | `/api/v1/auth/forgot-password` | `ForgotPasswordController` | ThrottleRequests:auth-forgot-password |
| ✎ | POST | `/api/v1/auth/login` | `LoginController` | ThrottleRequests:auth-login |
| ✎ | POST | `/api/v1/auth/logout` | `LogoutController` | auth:sanctum |
| ✎ | POST | `/api/v1/auth/logout-others` | `LogoutOthersController` | auth:sanctum |
|  | GET | `/api/v1/auth/me` | `MeController` | auth:sanctum |
| ✎ | DELETE | `/api/v1/auth/oauth/max` | `MaxAuthController@unlink` | auth:sanctum,ThrottleRequests:auth-max-start |
| ✎ | POST | `/api/v1/auth/oauth/max/link` | `MaxAuthController@link` | auth:sanctum,ThrottleRequests:auth-max-start |
| ✎ | POST | `/api/v1/auth/oauth/max/start` | `MaxAuthController@start` | ThrottleRequests:auth-max-start |
|  | GET | `/api/v1/auth/oauth/max/status` | `MaxAuthController@status` | ThrottleRequests:auth-max-status |
|  | GET | `/api/v1/auth/oauth/{provider}/callback` | `OAuthController@callback` | — |
|  | GET | `/api/v1/auth/oauth/{provider}/redirect` | `OAuthController@redirect` | — |
| ✎ | POST | `/api/v1/auth/register` | `RegisterController` | ThrottleRequests:auth-register |
| ✎ | POST | `/api/v1/auth/reset-password` | `ResetPasswordController` | ThrottleRequests:auth-reset-password |
| ✎ | POST | `/api/v1/auth/verify-email` | `VerifyEmailController` | ThrottleRequests:auth-verify |
|  | GET | `/api/v1/broadcasting/auth` | `BroadcastController@authenticate` | auth:sanctum |
| ✎ | POST | `/api/v1/broadcasting/auth` | `BroadcastController@authenticate` | auth:sanctum |
|  | GET | `/api/v1/calls` | `CallController@history` | auth:sanctum |
| ✎ | POST | `/api/v1/calls` | `CallController@initiate` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/calls/group/invite` | `LiveKitController@invite` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/calls/ice-servers` | `CallController@iceServers` | auth:sanctum |
|  | GET | `/api/v1/calls/incoming` | `CallController@incoming` | auth:sanctum |
| ✎ | POST | `/api/v1/calls/livekit/token` | `LiveKitController@token` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/calls/{uuid}/answer` | `CallController@answer` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/calls/{uuid}/hangup` | `CallController@hangup` | auth:sanctum |
| ✎ | POST | `/api/v1/calls/{uuid}/ice` | `CallController@ice` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/calls/{uuid}/reject` | `CallController@reject` | auth:sanctum |
| ✎ | POST | `/api/v1/calls/{uuid}/restart` | `CallController@restart` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/categories/communities` | `CommunityCategoryTreeController` | — |
|  | GET | `/api/v1/categories/listings` | `ListingCategoryTreeController` | — |
|  | GET | `/api/v1/categories/posts` | `PostCategoryTreeController` | — |
|  | GET | `/api/v1/categories/posts/rooms/stats` | `IndexCategoryRoomStatsController` | auth:sanctum |
|  | GET | `/api/v1/categories/posts/{parentId}/rooms/stats` | `IndexCategoryRoomStatsController` | auth:sanctum |
|  | GET | `/api/v1/categories/posts/{parentId}/rooms/{subId}/conversation` | `ShowCategoryRoomConversationController` | auth:sanctum |
|  | GET | `/api/v1/categories/posts/{parentId}/rooms/{subId}/members` | `IndexCategoryRoomMembersController` | auth:sanctum |
|  | GET | `/api/v1/channels` | `ChannelController@index` | ResolveOptionalUser |
| ✎ | POST | `/api/v1/channels/apply` | `ApplyChannelController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/channels/{slug}` | `DeleteChannelController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/channels/{slug}` | `ChannelController@show` | ResolveOptionalUser |
| ✎ | PATCH | `/api/v1/channels/{slug}` | `UpdateChannelController` | auth:sanctum,EnsureFullyVerified |
| ✎ | PATCH | `/api/v1/channels/{slug}/branding` | `ChannelController@updateBranding` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/channels/{slug}/posts` | `ChannelController@posts` | ResolveOptionalUser |
| ✎ | POST | `/api/v1/channels/{slug}/posts` | `ChannelController@storePost` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/channels/{slug}/posts/{postUuid}` | `DeleteChannelPostController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/channels/{slug}/posts/{postUuid}/like` | `ChannelController@unlike` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/channels/{slug}/posts/{postUuid}/like` | `ChannelController@like` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/channels/{slug}/posts/{postUuid}/pin` | `ChannelController@unpin` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/channels/{slug}/posts/{postUuid}/pin` | `ChannelController@pin` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/channels/{slug}/posts/{postUuid}/view` | `ChannelController@view` | ResolveOptionalUser |
| ✎ | DELETE | `/api/v1/channels/{slug}/subscribe` | `ChannelController@unsubscribe` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/channels/{slug}/subscribe` | `ChannelController@subscribe` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/cities` | `CitiesController` | — |
| ✎ | DELETE | `/api/v1/comments/{uuid}` | `DestroyCommentController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/comments/{uuid}/react` | `CommentReactionController@destroy` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/comments/{uuid}/react` | `CommentReactionController@store` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/comments/{uuid}/thread` | `CommentThreadController` | ResolveOptionalUser |
|  | GET | `/api/v1/communities` | `IndexCommunityController` | EnsureCommunitiesEnabled,ResolveOptionalUser |
| ✎ | POST | `/api/v1/communities/apply` | `ApplyCommunityController` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/communities/{slug}` | `DeleteCommunityController` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/communities/{slug}` | `ShowCommunityController` | EnsureCommunitiesEnabled,ResolveOptionalUser |
| ✎ | PATCH | `/api/v1/communities/{slug}` | `UpdateCommunityController` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | PATCH | `/api/v1/communities/{slug}/branding` | `UpdateCommunityBrandingController` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/communities/{slug}/chat` | `CommunityChatController` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/communities/{slug}/events` | `CommunityEventsController@index` | EnsureCommunitiesEnabled,ResolveOptionalUser |
| ✎ | POST | `/api/v1/communities/{slug}/events` | `CommunityEventsController@store` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/communities/{slug}/events/{uuid}/attend` | `CommunityEventsController@attend` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/communities/{slug}/favorite` | `CommunityFavoriteController@destroy` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/communities/{slug}/favorite` | `CommunityFavoriteController@store` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/communities/{slug}/invitable-friends` | `CommunityInviteController@index` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/communities/{slug}/invite` | `CommunityInviteController@store` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/communities/{slug}/join` | `JoinCommunityController` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/communities/{slug}/join-requests` | `CommunityJoinRequestsController@index` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/communities/{slug}/join-requests/{id}/approve` | `CommunityJoinRequestsController@approve` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/communities/{slug}/join-requests/{id}/reject` | `CommunityJoinRequestsController@reject` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/communities/{slug}/leave` | `LeaveCommunityController` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/communities/{slug}/members` | `CommunityMembersController` | EnsureCommunitiesEnabled,ResolveOptionalUser |
| ✎ | DELETE | `/api/v1/communities/{slug}/members/{userUuid}` | `CommunityJoinRequestsController@ban` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
| ✎ | PUT | `/api/v1/communities/{slug}/notifications` | `CommunityNotificationsController` | EnsureCommunitiesEnabled,ResolveOptionalUser,auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/communities/{slug}/posts` | `CommunityPostsController` | EnsureCommunitiesEnabled,ResolveOptionalUser |
|  | GET | `/api/v1/communities/{slug}/similar` | `SimilarCommunitiesController` | EnsureCommunitiesEnabled,ResolveOptionalUser |
| ✎ | POST | `/api/v1/consents/{type}/revoke` | `RevokeConsentController` | auth:sanctum |
|  | GET | `/api/v1/conversations` | `IndexConversationsController` | auth:sanctum |
| ✎ | POST | `/api/v1/conversations` | `StoreConversationController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/conversations/{uuid}` | `DestroyConversationController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/conversations/{uuid}` | `ShowConversationController` | auth:sanctum |
| ✎ | POST | `/api/v1/conversations/{uuid}/attachments` | `StoreAttachmentController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/conversations/{uuid}/history` | `ClearConversationHistoryController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/conversations/{uuid}/messages` | `IndexMessagesController` | auth:sanctum |
| ✎ | POST | `/api/v1/conversations/{uuid}/messages` | `StoreMessageController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/conversations/{uuid}/messages/{messageUuid}` | `HideMessageController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/conversations/{uuid}/messages/{messageUuid}/everyone` | `DeleteMessageForEveryoneController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/conversations/{uuid}/messages/{messageUuid}/pin` | `UnpinMessageController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/conversations/{uuid}/messages/{messageUuid}/pin` | `PinMessageController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/conversations/{uuid}/pin` | `UnpinConversationController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/conversations/{uuid}/pin` | `PinConversationController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/conversations/{uuid}/read` | `MarkConversationReadController` | auth:sanctum |
| ✎ | POST | `/api/v1/cookie-preferences` | `StoreCookiePreferencesController` | — |
| ✎ | POST | `/api/v1/csp-report` | `CspReportController` | ThrottleRequests:60,1 |
|  | GET | `/api/v1/delivery/cdek/cities` | `CdekCitiesController` | — |
|  | GET | `/api/v1/delivery/cdek/pickup-points` | `CdekPickupPointsController` | — |
| ✎ | POST | `/api/v1/delivery/cdek/quote` | `CdekQuoteController` | — |
| ✎ | POST | `/api/v1/delivery/yandex/location/detect` | `YandexDetectLocationController` | — |
|  | GET | `/api/v1/delivery/yandex/pickup-points` | `YandexPickupPointsController` | — |
| ✎ | POST | `/api/v1/delivery/yandex/quote` | `YandexQuoteController` | — |
| ✎ | POST | `/api/v1/diagnostics/logs` | `ClientLogController@store` | auth:sanctum |
|  | GET | `/api/v1/feed` | `IndexFeedController` | ResolveOptionalUser |
| ✎ | POST | `/api/v1/feedback` | `FeedbackController@store` | — |
|  | GET | `/api/v1/footer-links` | `FooterLinksController` | — |
| ✎ | DELETE | `/api/v1/friend-requests/{id}` | `FriendController@cancel` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/friend-requests/{id}/accept` | `FriendController@accept` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/friend-requests/{id}/decline` | `FriendController@decline` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/geo/address-suggest` | `SuggestAddressController` | ThrottleRequests:30,1 |
|  | GET | `/api/v1/health` | `HealthController` | — |
|  | GET | `/api/v1/icon-overrides` | `IconOverridesController` | — |
|  | GET | `/api/v1/legal/{slug}` | `ShowLegalPageController` | — |
|  | GET | `/api/v1/listings` | `IndexListingsController` | ResolveOptionalUser |
| ✎ | POST | `/api/v1/listings` | `StoreListingController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/listings/ai-suggest` | `AiSuggestListingController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/listings/boost-packages` | `BoostPackagesController` | — |
|  | GET | `/api/v1/listings/placement-quote` | `PlacementQuoteController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/listings/{uuid}` | `DestroyListingController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/listings/{uuid}` | `ShowListingController` | ResolveOptionalUser |
| ✎ | PATCH | `/api/v1/listings/{uuid}` | `UpdateListingController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/listings/{uuid}/archive` | `ListingStatusController@archive` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/listings/{uuid}/favorite` | `ListingFavoriteController@destroy` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/listings/{uuid}/favorite` | `ListingFavoriteController@store` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/listings/{uuid}/promote` | `PromoteListingController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/listings/{uuid}/publish` | `ListingStatusController@publish` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/listings/{uuid}/restore` | `RestoreListingController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/listings/{uuid}/reveal-phone` | `RevealPhoneController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/listings/{uuid}/safe-deal` | `CreateSafeDealController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/listings/{uuid}/safe-deal/quote` | `QuoteSafeDealController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/me` | `DestroyMyAccountController` | auth:sanctum |
|  | GET | `/api/v1/me/consents` | `IndexMyConsentsController` | auth:sanctum |
|  | GET | `/api/v1/me/data/export` | `ExportMyDataController` | auth:sanctum |
|  | GET | `/api/v1/me/entity-requests` | `MyEntityRequestsController` | auth:sanctum |
| ✎ | DELETE | `/api/v1/me/view-history` | `ClearViewHistoryController` | auth:sanctum |
|  | GET | `/api/v1/me/view-history` | `IndexViewHistoryController` | auth:sanctum |
| ✎ | POST | `/api/v1/me/view-history` | `StoreViewHistoryController` | auth:sanctum |
| ✎ | POST | `/api/v1/media` | `DirectUploadController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/media/confirm` | `ConfirmUploadController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/media/fail` | `FailUploadController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/media/upload-session` | `UploadSessionController@store` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/media/{uuid}` | `ServeMediaController` | — |
| ✎ | POST | `/api/v1/media/{uuid}/transcribe` | `TranscribeMediaController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/media/{uuid}/{variant}` | `ServeMediaController` | — |
| ✎ | POST | `/api/v1/payments` | `CreatePaymentController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/payments/webhooks/vtb` | `VtbWebhookController` | — |
| ✎ | POST | `/api/v1/payments/webhooks/vtb` | `VtbWebhookController` | — |
|  | GET | `/api/v1/payments/{uuid}` | `ShowPaymentController` | auth:sanctum |
| ✎ | POST | `/api/v1/payments/{uuid}/confirm-stub` | `ConfirmStubPaymentController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/payments/{uuid}/sync` | `SyncPaymentController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/plans` | `IndexPlansController` | — |
| ✎ | POST | `/api/v1/posts` | `StorePostController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/posts/{uuid}` | `DestroyPostController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/posts/{uuid}` | `ShowPostController` | ResolveOptionalUser |
| ✎ | PATCH | `/api/v1/posts/{uuid}` | `UpdatePostController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/posts/{uuid}/bookmark` | `PostBookmarkController@destroy` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/posts/{uuid}/bookmark` | `PostBookmarkController@store` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/posts/{uuid}/comments` | `PostCommentsController@index` | ResolveOptionalUser |
| ✎ | POST | `/api/v1/posts/{uuid}/comments` | `PostCommentsController@store` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/posts/{uuid}/publish` | `PublishPostController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/posts/{uuid}/react` | `PostReactionController@destroy` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/posts/{uuid}/react` | `PostReactionController@store` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/posts/{uuid}/repost` | `UnrepostPostController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/posts/{uuid}/repost` | `RepostPostController` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/posts/{uuid}/schedule` | `CancelScheduledPostController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/posts/{uuid}/schedule` | `SchedulePostController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/public/banners` | `BannersController` | — |
| ✎ | POST | `/api/v1/public/banners/{id}/events` | `RecordBannerEventController` | — |
|  | GET | `/api/v1/public/bootstrap` | `PublicBootstrapController` | — |
|  | GET | `/api/v1/public/branding` | `SiteBrandingController` | — |
|  | GET | `/api/v1/public/delivery-methods` | `IndexDeliveryMethodsController` | — |
|  | GET | `/api/v1/public/faq` | `FaqController` | — |
|  | GET | `/api/v1/public/feature-flags` | `FeatureFlagsController` | — |
|  | GET | `/api/v1/public/feed-guest-access` | `FeedGuestAccessController` | — |
|  | GET | `/api/v1/public/footer-contacts` | `FooterContactsController` | — |
|  | GET | `/api/v1/public/landing-blocks` | `LandingBlocksController` | — |
|  | GET | `/api/v1/public/landing-stats` | `LandingStatsController` | — |
|  | GET | `/api/v1/public/placement-pricing` | `PlacementPricingController` | — |
| ✎ | POST | `/api/v1/public/referrals/click` | `TrackReferralClickController` | — |
|  | GET | `/api/v1/public/stats` | `StatsController` | — |
|  | GET | `/api/v1/public/tariffs` | `TariffsController` | — |
| ✎ | POST | `/api/v1/reports` | `StoreReportController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/rules` | `IndexRulePagesController` | — |
|  | GET | `/api/v1/rules/{slug}` | `ShowRulePageController` | — |
|  | GET | `/api/v1/safe-deals` | `IndexSafeDealsController` | auth:sanctum |
| ✎ | POST | `/api/v1/safe-deals/webhooks/delivery` | `SafeDealDeliveryWebhookController` | — |
|  | GET | `/api/v1/safe-deals/webhooks/vtb` | `SafeDealVtbWebhookController` | — |
| ✎ | POST | `/api/v1/safe-deals/webhooks/vtb` | `SafeDealVtbWebhookController` | — |
| ✎ | POST | `/api/v1/safe-deals/webhooks/vtb-payout` | `SafeDealPayoutWebhookController` | — |
|  | GET | `/api/v1/safe-deals/{uuid}` | `ShowSafeDealController` | auth:sanctum |
| ✎ | POST | `/api/v1/safe-deals/{uuid}/cancel` | `SafeDealActionsController@cancel` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/safe-deals/{uuid}/confirm` | `SafeDealActionsController@confirm` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/safe-deals/{uuid}/delivered` | `SafeDealActionsController@delivered` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/safe-deals/{uuid}/dispute` | `SafeDealActionsController@dispute` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/safe-deals/{uuid}/review` | `ReviewSafeDealController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/safe-deals/{uuid}/ship` | `SafeDealActionsController@ship` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/shipments` | `IndexShipmentsController` | auth:sanctum |
| ✎ | POST | `/api/v1/shipments` | `StoreShipmentController` | auth:sanctum |
|  | GET | `/api/v1/shipments/{shipment}` | `ShowShipmentController` | auth:sanctum |
| ✎ | PATCH | `/api/v1/shipments/{shipment}` | `UpdateShipmentController` | auth:sanctum |
| ✎ | POST | `/api/v1/shipments/{shipment}/cancel` | `CancelShipmentController` | auth:sanctum |
| ✎ | POST | `/api/v1/shipments/{shipment}/confirm` | `ConfirmShipmentController` | auth:sanctum |
| ✎ | POST | `/api/v1/shipments/{shipment}/quote` | `QuoteShipmentController` | auth:sanctum |
| ✎ | POST | `/api/v1/shipments/{shipment}/request-seller` | `RequestShipmentSellerController` | auth:sanctum |
| ✎ | POST | `/api/v1/shipments/{shipment}/sync` | `SyncShipmentStatusController` | auth:sanctum |
|  | GET | `/api/v1/tags` | `TagsController` | — |
|  | GET | `/api/v1/users/me` | `ShowMeController` | auth:sanctum |
| ✎ | PATCH | `/api/v1/users/me` | `UpdateProfileController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/users/me/blocks` | `BlockController@index` | auth:sanctum |
|  | GET | `/api/v1/users/me/delivery-profile` | `IndexSellerDeliveryProfileController` | auth:sanctum |
| ✎ | POST | `/api/v1/users/me/delivery-profile` | `StoreSellerDeliveryProfileController` | auth:sanctum |
| ✎ | DELETE | `/api/v1/users/me/delivery-profile/{seller_delivery_profile}` | `DestroySellerDeliveryProfileController` | auth:sanctum |
| ✎ | PATCH | `/api/v1/users/me/delivery-profile/{seller_delivery_profile}` | `UpdateSellerDeliveryProfileController` | auth:sanctum |
|  | GET | `/api/v1/users/me/favorites` | `FavoriteListingsController` | auth:sanctum |
|  | GET | `/api/v1/users/me/feedback` | `MyFeedbackController` | auth:sanctum |
|  | GET | `/api/v1/users/me/friend-requests` | `FriendController@indexIncomingRequests` | auth:sanctum |
|  | GET | `/api/v1/users/me/friend-requests/sent` | `FriendController@indexOutgoingRequests` | auth:sanctum |
|  | GET | `/api/v1/users/me/friends` | `FriendController@indexFriends` | auth:sanctum |
| ✎ | DELETE | `/api/v1/users/me/friends/{id}` | `FriendController@destroyFriend` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/users/me/interests` | `InterestsController@show` | auth:sanctum |
| ✎ | PUT | `/api/v1/users/me/interests` | `InterestsController@sync` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/users/me/listings` | `MyListingsController` | auth:sanctum |
| ✎ | DELETE | `/api/v1/users/me/notifications` | `NotificationController@destroyAll` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/users/me/notifications` | `NotificationController@index` | auth:sanctum |
| ✎ | POST | `/api/v1/users/me/notifications/read-all` | `NotificationController@markAllRead` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/users/me/notifications/unread-count` | `NotificationController@unreadCount` | auth:sanctum |
| ✎ | DELETE | `/api/v1/users/me/notifications/{id}` | `NotificationController@destroy` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/users/me/notifications/{id}/read` | `NotificationController@markRead` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/users/me/payments` | `MyPaymentsController` | auth:sanctum |
|  | GET | `/api/v1/users/me/pickup-addresses` | `RecentPickupAddressesController` | auth:sanctum |
| ✎ | POST | `/api/v1/users/me/presence` | `PresenceHeartbeatController` | auth:sanctum |
| ✎ | PATCH | `/api/v1/users/me/privacy` | `PrivacyController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/users/me/referrals` | `ReferralController` | auth:sanctum |
| ✎ | POST | `/api/v1/users/me/referrals/claim` | `ClaimReferralController` | auth:sanctum |
| ✎ | POST | `/api/v1/users/me/reviews/{uuid}/reply` | `UserReviewsController@reply` | auth:sanctum |
|  | GET | `/api/v1/users/me/settings` | `SettingsController@show` | auth:sanctum |
| ✎ | PATCH | `/api/v1/users/me/settings` | `SettingsController@update` | auth:sanctum |
|  | GET | `/api/v1/users/me/stats` | `MyStatsController` | auth:sanctum |
|  | GET | `/api/v1/users/me/stats/views-daily` | `MyStatsViewsDailyController` | auth:sanctum |
|  | GET | `/api/v1/users/me/subscription` | `MySubscriptionController` | auth:sanctum |
| ✎ | POST | `/api/v1/users/me/subscription/cancel` | `CancelSubscriptionController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/users/search` | `IndexUsersController` | auth:sanctum |
| ✎ | DELETE | `/api/v1/users/{id}/block` | `BlockController@destroy` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/users/{id}/block` | `BlockController@store` | auth:sanctum,EnsureFullyVerified |
| ✎ | DELETE | `/api/v1/users/{id}/follow` | `FollowController@destroy` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/users/{id}/follow` | `FollowController@store` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/users/{id}/friend-request` | `FriendController@storeRequest` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/users/{id}/rating` | `UserRatingController` | — |
|  | GET | `/api/v1/users/{id}/reviews` | `UserReviewsController` | — |
|  | GET | `/api/v1/users/{slug}` | `ShowProfileController` | — |
|  | GET | `/api/v1/users/{slug}/listings` | `UserListingsController` | — |
|  | GET | `/api/v1/videos` | `IndexVideosController` | ResolveOptionalUser |
| ✎ | POST | `/api/v1/videos` | `StoreVideoController` | auth:sanctum,EnsureFullyVerified,RequiresSubscription |
|  | GET | `/api/v1/videos/categories` | `IndexVideoCategoriesController` | ResolveOptionalUser |
|  | GET | `/api/v1/videos/tags` | `IndexVideoTagsController` | ResolveOptionalUser |
| ✎ | DELETE | `/api/v1/videos/{uuid}` | `DestroyVideoController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/videos/{uuid}` | `ShowVideoController` | ResolveOptionalUser |
| ✎ | PATCH | `/api/v1/videos/{uuid}` | `UpdateVideoController` | auth:sanctum,EnsureFullyVerified,RequiresSubscription |
|  | GET | `/api/v1/videos/{uuid}/comments` | `VideoCommentsController` | ResolveOptionalUser |
| ✎ | POST | `/api/v1/videos/{uuid}/comments` | `StoreVideoCommentController` | auth:sanctum,EnsureFullyVerified,RequiresSubscription |
| ✎ | DELETE | `/api/v1/videos/{uuid}/react` | `VideoReactionController@destroy` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/videos/{uuid}/react` | `VideoReactionController@store` | auth:sanctum,EnsureFullyVerified,RequiresSubscription |
| ✎ | DELETE | `/api/v1/videos/{uuid}/schedule` | `CancelScheduledVideoController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/videos/{uuid}/schedule` | `ScheduleVideoController` | auth:sanctum,EnsureFullyVerified,RequiresSubscription |
| ✎ | POST | `/api/v1/videos/{uuid}/view` | `VideoViewController` | ResolveOptionalUser |
|  | GET | `/api/v1/wallet` | `WalletBalanceController` | auth:sanctum |
| ✎ | POST | `/api/v1/wallet/topup` | `WalletTopupController` | auth:sanctum,EnsureFullyVerified |
|  | GET | `/api/v1/wallet/transactions` | `WalletTransactionsController` | auth:sanctum |
| ✎ | POST | `/api/v1/wallet/withdraw` | `WalletWithdrawController` | auth:sanctum,EnsureFullyVerified |
| ✎ | POST | `/api/v1/webhooks/cdek/order-status` | `CdekOrderStatusWebhookController` | — |
| ✎ | POST | `/api/v1/webhooks/max` | `MaxWebhookController` | — |
| ✎ | POST | `/api/v1/webhooks/yandex/delivery-status` | `YandexDeliveryStatusWebhookController` | — |
