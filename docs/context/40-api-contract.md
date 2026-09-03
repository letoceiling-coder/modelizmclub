# 40 — Контракт API: фронт против бэка

## Как получено и насколько этому можно верить

Вызовы фронта извлечены регулярным выражением по обёрткам `api(...)` /
`apiRaw(...)` в `frontend/src/**/*.ts(x)`; маршруты — из `php artisan
route:list` на проде. Параметры в путях нормализованы к `{}`.

**Метод определяется не всегда.** Если рядом с вызовом нет литерала
`method: "POST"` (например, метод передаётся переменной или через хелпер),
детектор считает вызов `GET`. Поэтому список «фронт зовёт несуществующее»
содержит ложные срабатывания, и каждую строку в нём нужно проверять глазами.
Я проверил четыре — три оказались артефактами.

Разобрано: **304** вызова фронта, **444** маршрута бэка.

| Категория | Строк |
|---|---:|
| Совпадает | **287** |
| Фронт зовёт несуществующее | **17** (с оговоркой выше) |
| Эндпоинт есть, фронт не использует | **118** |

## Проверенное вручную из списка «несуществующее»

| Вызов фронта | Что на самом деле | Вердикт |
|---|---|---|
| `GET /me/consents` (`lib/api/legal.ts:57`) | на бэке есть `GET /api/v1/me/consents` | ложное срабатывание |
| `POST /users/{}/reviews` (`lib/api/rating.ts`) | есть `GET /users/{id}/reviews`; POST для создания отзыва **не найден** | требует проверки |
| `GET /posts/{}/react`, `/bookmark`, `/repost` | на бэке `POST`/`DELETE /posts/{uuid}/react` | ложное срабатывание (метод в переменной) |
| `GET /footer-links` (`lib/api/legal.ts:48`, `auth: false`) | на бэке только `/admin/footer-links` под админом | **реальное расхождение** |

`/footer-links` — единственное, что подтверждено как настоящий разрыв:
фронт запрашивает публичный список ссылок футера без авторизации, а такого
маршрута нет; есть только админский.

## Совпадает — 287

| Метод | Путь | Где вызывается |
|---|---|---|
| DELETE | `/account/payment-methods/{}` | `lib/api/payment.ts` |
| DELETE | `/admin/banners/{}` | `lib/api/admin.ts` |
| DELETE | `/admin/faq/articles/{}` | `lib/api/faq.ts` |
| DELETE | `/admin/faq/categories/{}` | `lib/api/faq.ts` |
| DELETE | `/admin/footer-links/{}` | `lib/api/legal.ts` |
| DELETE | `/admin/icon-assets/{}` | `lib/api/icons.ts` |
| DELETE | `/admin/landing/cards/{}` | `lib/api/admin.ts` |
| DELETE | `/admin/listings/{}` | `lib/api/admin.ts` |
| DELETE | `/admin/posts/{}` | `lib/api/admin.ts` |
| DELETE | `/admin/promocodes/{}` | `lib/api/admin.ts` |
| DELETE | `/admin/rule-pages/{}` | `lib/api/rules.ts` |
| DELETE | `/admin/users/{}` | `lib/api/admin.ts` |
| DELETE | `/admin/videos/{}` | `lib/api/admin.ts` |
| DELETE | `/auth/oauth/max` | `lib/api/oauth.ts` |
| DELETE | `/channels/{}` | `lib/channels.ts` |
| DELETE | `/channels/{}/posts/{}` | `lib/channels.ts` |
| DELETE | `/comments/{}` | `lib/api/feed.ts` |
| DELETE | `/comments/{}/react` | `lib/api/feed.ts` |
| DELETE | `/communities/{}` | `lib/api/communities.ts` |
| DELETE | `/communities/{}/leave` | `lib/api/communities.ts` |
| DELETE | `/communities/{}/members/{}` | `lib/api/communities.ts` |
| DELETE | `/conversations/{}` | `lib/api/chat.ts` |
| DELETE | `/conversations/{}/history` | `lib/api/chat.ts` |
| DELETE | `/conversations/{}/messages/{}` | `lib/api/chat.ts` |
| DELETE | `/conversations/{}/messages/{}/everyone` | `lib/api/chat.ts` |
| DELETE | `/conversations/{}/messages/{}/pin` | `lib/api/chat.ts` |
| DELETE | `/conversations/{}/pin` | `lib/api/chat.ts` |
| DELETE | `/friend-requests/{}` | `lib/api/social.ts` |
| DELETE | `/listings/{}` | `lib/api/listings.ts` |
| DELETE | `/listings/{}/favorite` | `lib/api/listings.ts` |
| DELETE | `/me` | `lib/api/legal.ts` |
| DELETE | `/me/view-history` | `lib/api/view-history-api.ts` |
| DELETE | `/posts/{}` | `lib/api/feed.ts` |
| DELETE | `/posts/{}/schedule` | `lib/api/feed.ts` |
| DELETE | `/users/me/friends/{}` | `lib/api/social.ts` |
| DELETE | `/users/me/notifications` | `lib/api/notifications.ts` |
| DELETE | `/users/me/notifications/{}` | `lib/api/notifications.ts` |
| DELETE | `/users/{}/block` | `lib/api/social.ts` |
| DELETE | `/users/{}/follow` | `lib/api/social.ts` |
| DELETE | `/videos/{}` | `lib/api/reviews.ts` |
| DELETE | `/videos/{}/react` | `lib/api/reviews.ts` |
| GET | `/account/payment-methods` | `lib/api/payment.ts` |
| GET | `/account/payout-requisites` | `lib/api/payout-requisites.ts` |
| GET | `/account/requisites` | `lib/api/account.ts` |
| GET | `/admin/channels/applications` | `lib/api/entity-requests.ts` |
| GET | `/admin/communities/applications` | `lib/api/entity-requests.ts` |
| GET | `/admin/dashboard` | `lib/api/admin.ts` |
| GET | `/admin/delivery/methods` | `lib/api/admin.ts` |
| GET | `/admin/delivery/stats` | `lib/api/admin.ts` |
| GET | `/admin/diagnostics` | `lib/api/admin.ts` |
| GET | `/admin/disputes` | `lib/api/admin.ts` |
| GET | `/admin/faq` | `lib/api/faq.ts` |
| GET | `/admin/feed/guest-access` | `lib/api/feed-guest-access.ts` |
| GET | `/admin/footer-links` | `lib/api/legal.ts` |
| GET | `/admin/icon-assets` | `lib/api/icons.ts` |
| GET | `/admin/landing/blocks` | `lib/api/admin.ts` |
| GET | `/admin/legal-pages` | `lib/api/legal.ts` |
| GET | `/admin/legal-pages/{}/revisions` | `lib/api/legal.ts` |
| GET | `/admin/listings/{}` | `lib/api/admin.ts` |
| GET | `/admin/notifications/policy` | `lib/api/notification-policy.ts` |
| GET | `/admin/promo-pools` | `lib/api/admin.ts` |
| GET | `/admin/referrals` | `lib/api/admin.ts` |
| GET | `/admin/rule-pages` | `lib/api/rules.ts` |
| GET | `/admin/rule-pages/{}` | `lib/api/rules.ts` |
| GET | `/admin/rule-pages/{}/revisions` | `lib/api/rules.ts` |
| GET | `/admin/safe-deals` | `lib/api/admin.ts` |
| GET | `/admin/settings` | `lib/api/admin.ts` |
| GET | `/admin/videos/{}` | `lib/api/admin.ts` |
| GET | `/admin/wallets` | `lib/api/admin.ts` |
| GET | `/admin/withdrawals` | `lib/api/admin.ts` |
| GET | `/auth/me` | `lib/api/auth.ts` |
| GET | `/auth/oauth/max/status` | `lib/api/oauth.ts` |
| GET | `/calls` | `lib/api/calls.ts` |
| GET | `/calls/ice-servers` | `lib/api/calls.ts` |
| GET | `/calls/incoming` | `lib/api/calls.ts` |
| GET | `/categories/communities` | `lib/api/entity-requests.ts` |
| GET | `/categories/listings` | `lib/api/categories.ts` |
| GET | `/categories/posts` | `lib/api/categories.ts` |
| GET | `/categories/posts/{}/rooms/{}/conversation` | `lib/api/room-chat.ts` |
| GET | `/channels` | `lib/channels.ts` |
| GET | `/channels/{}` | `lib/channels.ts` |
| GET | `/channels/{}/posts` | `lib/channels.ts` |
| GET | `/cities` | `lib/api/cities.ts` |
| GET | `/communities/{}` | `lib/api/communities.ts` |
| GET | `/communities/{}/chat` | `lib/api/communities.ts` |
| GET | `/communities/{}/events` | `lib/api/communities.ts` |
| GET | `/communities/{}/posts` | `lib/api/communities.ts` |
| GET | `/conversations/{}` | `lib/api/chat.ts` |
| GET | `/delivery/cdek/pickup-points` | `lib/api/cdek.ts` |
| GET | `/geo/address-suggest` | `lib/api/geo.ts` |
| GET | `/icon-overrides` | `lib/api/icons.ts` |
| GET | `/legal/{}` | `lib/api/legal.ts` |
| GET | `/listings/boost-packages` | `lib/api/listings.ts` |
| GET | `/listings/placement-quote` | `lib/api/listing-placement.ts` |
| GET | `/listings/{}` | `lib/api/listings.ts` |
| GET | `/me/entity-requests` | `lib/api/entity-requests.ts` |
| GET | `/me/view-history` | `lib/api/view-history-api.ts` |
| GET | `/payments/{}` | `lib/api/payment.ts` |
| GET | `/plans` | `lib/api/payment.ts` |
| GET | `/posts/{}` | `lib/api/feed.ts` |
| GET | `/public/banners` | `lib/api/banners.ts` |
| GET | `/public/bootstrap` | `lib/api/bootstrap.ts` |
| GET | `/public/branding` | `lib/api/site.ts` |
| GET | `/public/delivery-methods` | `lib/api/site.ts` |
| GET | `/public/faq` | `lib/api/content.ts` |
| GET | `/public/feature-flags` | `lib/config/featureFlags.ts` |
| GET | `/public/feed-guest-access` | `lib/api/feed-guest-access.ts` |
| GET | `/public/footer-contacts` | `lib/api/site.ts` |
| GET | `/public/landing-blocks` | `lib/api/landing-blocks.ts` |
| GET | `/public/landing-stats` | `lib/api/landing.ts` |
| GET | `/public/placement-pricing` | `lib/api/placement-pricing.ts` |
| GET | `/public/stats` | `lib/api/content.ts` |
| GET | `/rules` | `lib/api/rules.ts` |
| GET | `/rules/{}` | `lib/api/rules.ts` |
| GET | `/safe-deals` | `lib/api/safe-deals.ts` |
| GET | `/safe-deals/{}` | `lib/api/safe-deals.ts` |
| GET | `/users/me/friend-requests` | `lib/api/social.ts` |
| GET | `/users/me/friend-requests/sent` | `lib/api/social.ts` |
| GET | `/users/me/notifications` | `lib/api/notifications.ts` |
| GET | `/users/me/notifications/unread-count` | `lib/api/notifications.ts` |
| GET | `/users/me/pickup-addresses` | `lib/api/geo.ts` |
| GET | `/users/me/referrals` | `lib/api/referral.ts` |
| GET | `/users/me/settings` | `lib/api/notification-prefs.ts` |
| GET | `/users/me/stats` | `lib/api/seller-stats.ts` |
| GET | `/users/me/stats/views-daily` | `lib/api/seller-stats.ts` |
| GET | `/users/me/subscription` | `lib/api/payment.ts` |
| GET | `/users/{}` | `lib/api/social.ts` |
| GET | `/users/{}/rating` | `lib/api/rating.ts` |
| GET | `/videos/tags` | `lib/api/reviews.ts` |
| GET | `/videos/{}` | `lib/api/reviews.ts` |
| GET | `/wallet` | `lib/api/wallet.ts` |
| GET | `/wallet/transactions` | `lib/api/wallet.ts` |
| PATCH | `/admin/banners/carousel/settings` | `lib/api/admin.ts` |
| PATCH | `/admin/banners/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/categories/video/reorder` | `lib/api/admin.ts` |
| PATCH | `/admin/delivery/methods/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/delivery/shipments/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/faq/articles/{}` | `lib/api/faq.ts` |
| PATCH | `/admin/faq/categories/{}` | `lib/api/faq.ts` |
| PATCH | `/admin/feedback/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/landing/cards/reorder` | `lib/api/admin.ts` |
| PATCH | `/admin/landing/cards/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/landing/sections/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/listings/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/plans/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/posts/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/reports/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/settings` | `lib/api/admin.ts` |
| PATCH | `/admin/users/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/videos/{}` | `lib/api/admin.ts` |
| PATCH | `/admin/withdrawals/{}` | `lib/api/admin.ts` |
| PATCH | `/channels/{}` | `lib/channels.ts` |
| PATCH | `/channels/{}/branding` | `lib/channels.ts` |
| PATCH | `/communities/{}` | `lib/api/communities.ts` |
| PATCH | `/communities/{}/branding` | `lib/api/communities.ts` |
| PATCH | `/listings/{}` | `lib/api/listings.ts` |
| PATCH | `/posts/{}` | `lib/api/feed.ts` |
| PATCH | `/users/me` | `lib/api/social.ts` |
| PATCH | `/users/me/settings` | `lib/api/notification-prefs.ts` |
| PATCH | `/videos/{}` | `lib/api/reviews.ts` |
| POST | `/account/change-password` | `lib/api/auth.ts` |
| POST | `/account/email` | `lib/api/account.ts` |
| POST | `/account/email/verify/resend` | `lib/api/account.ts` |
| POST | `/account/payment-methods` | `lib/api/payment.ts` |
| POST | `/account/phone/send-code` | `lib/api/account.ts` |
| POST | `/account/phone/verify` | `lib/api/account.ts` |
| POST | `/account/resend-verification-email` | `lib/api/account.ts` |
| POST | `/admin/banners` | `lib/api/admin.ts` |
| POST | `/admin/disputes/{}/resolve` | `lib/api/admin.ts` |
| POST | `/admin/faq/articles` | `lib/api/faq.ts` |
| POST | `/admin/faq/articles/reorder` | `lib/api/faq.ts` |
| POST | `/admin/faq/categories` | `lib/api/faq.ts` |
| POST | `/admin/footer-links` | `lib/api/legal.ts` |
| POST | `/admin/footer-links/reorder` | `lib/api/legal.ts` |
| POST | `/admin/icon-assets/from-media` | `lib/api/icons.ts` |
| POST | `/admin/landing/cards` | `lib/api/admin.ts` |
| POST | `/admin/legal-pages` | `lib/api/legal.ts` |
| POST | `/admin/legal-pages/preview-markdown` | `lib/api/legal.ts` |
| POST | `/admin/legal-pages/{}/archive` | `lib/api/legal.ts` |
| POST | `/admin/legal-pages/{}/publish` | `lib/api/legal.ts` |
| POST | `/admin/legal-pages/{}/revisions/{}/restore` | `lib/api/legal.ts` |
| POST | `/admin/media` | `lib/api/admin-media.ts` |
| POST | `/admin/moderation/{}/{}/approve` | `lib/api/admin.ts` |
| POST | `/admin/moderation/{}/{}/reject` | `lib/api/admin.ts` |
| POST | `/admin/moderation/{}/{}/revision` | `lib/api/admin.ts` |
| POST | `/admin/notifications` | `lib/api/admin.ts` |
| POST | `/admin/promo-pools` | `lib/api/admin.ts` |
| POST | `/admin/promo-pools/{}/complete` | `lib/api/admin.ts` |
| POST | `/admin/promo-pools/{}/pause` | `lib/api/admin.ts` |
| POST | `/admin/promo-pools/{}/resume` | `lib/api/admin.ts` |
| POST | `/admin/promocodes` | `lib/api/admin.ts` |
| POST | `/admin/rule-pages` | `lib/api/rules.ts` |
| POST | `/admin/rule-pages/{}/duplicate` | `lib/api/rules.ts` |
| POST | `/admin/rule-pages/{}/publish` | `lib/api/rules.ts` |
| POST | `/admin/rule-pages/{}/revisions/{}/restore` | `lib/api/rules.ts` |
| POST | `/admin/safe-deals/{}/refund` | `lib/api/admin.ts` |
| POST | `/admin/safe-deals/{}/release` | `lib/api/admin.ts` |
| POST | `/admin/users/{}/subscription` | `lib/api/admin.ts` |
| POST | `/auth/forgot-password` | `lib/api/auth.ts` |
| POST | `/auth/login` | `lib/api/auth.ts` |
| POST | `/auth/logout` | `lib/api/auth.ts` |
| POST | `/auth/logout-others` | `lib/api/auth.ts` |
| POST | `/auth/oauth/max/link` | `lib/api/oauth.ts` |
| POST | `/auth/oauth/max/start` | `lib/api/oauth.ts` |
| POST | `/auth/register` | `lib/api/auth.ts` |
| POST | `/auth/reset-password` | `lib/api/auth.ts` |
| POST | `/auth/verify-email` | `lib/api/auth.ts` |
| POST | `/calls` | `lib/api/calls.ts` |
| POST | `/calls/group/invite` | `lib/api/livekit.ts` |
| POST | `/calls/livekit/token` | `lib/api/livekit.ts` |
| POST | `/calls/{}/answer` | `lib/api/calls.ts` |
| POST | `/calls/{}/hangup` | `lib/api/calls.ts` |
| POST | `/calls/{}/ice` | `lib/api/calls.ts` |
| POST | `/calls/{}/reject` | `lib/api/calls.ts` |
| POST | `/calls/{}/restart` | `lib/api/calls.ts` |
| POST | `/channels/apply` | `lib/api/entity-requests.ts` |
| POST | `/channels/{}/posts` | `lib/channels.ts` |
| POST | `/channels/{}/posts/{}/view` | `lib/channels.ts` |
| POST | `/communities/apply` | `lib/api/entity-requests.ts` |
| POST | `/communities/{}/events` | `lib/api/communities.ts` |
| POST | `/communities/{}/events/{}/attend` | `lib/api/communities.ts` |
| POST | `/communities/{}/join` | `lib/api/communities.ts` |
| POST | `/consents/{}/revoke` | `lib/api/legal.ts` |
| POST | `/conversations` | `lib/api/chat.ts` |
| POST | `/conversations/{}/attachments` | `lib/api/chat.ts` |
| POST | `/conversations/{}/messages` | `lib/api/chat.ts`, `lib/api/room-chat.ts` |
| POST | `/conversations/{}/messages/{}/pin` | `lib/api/chat.ts` |
| POST | `/conversations/{}/pin` | `lib/api/chat.ts` |
| POST | `/conversations/{}/read` | `lib/api/chat.ts` |
| POST | `/cookie-preferences` | `lib/api/legal.ts` |
| POST | `/diagnostics/logs` | `lib/logger.ts` |
| POST | `/feedback` | `lib/api/feedback.ts` |
| POST | `/friend-requests/{}/accept` | `lib/api/social.ts` |
| POST | `/friend-requests/{}/decline` | `lib/api/social.ts` |
| POST | `/listings` | `lib/api/listings.ts` |
| POST | `/listings/{}/archive` | `lib/api/listings.ts` |
| POST | `/listings/{}/favorite` | `lib/api/listings.ts` |
| POST | `/listings/{}/promote` | `lib/api/payment.ts` |
| POST | `/listings/{}/publish` | `lib/api/listings.ts` |
| POST | `/listings/{}/restore` | `lib/api/listings.ts` |
| POST | `/listings/{}/reveal-phone` | `lib/api/listings.ts` |
| POST | `/listings/{}/safe-deal` | `lib/api/safe-deals.ts` |
| POST | `/listings/{}/safe-deal/quote` | `lib/api/safe-deals.ts` |
| POST | `/me/view-history` | `lib/api/view-history-api.ts` |
| POST | `/media` | `lib/api/chat.ts`, `lib/api/icons.ts` … |
| POST | `/media/confirm` | `lib/api/media.ts` |
| POST | `/media/fail` | `lib/api/media.ts` |
| POST | `/media/{}/transcribe` | `lib/api/chat.ts` |
| POST | `/payments` | `lib/api/payment.ts` |
| POST | `/payments/{}/confirm-stub` | `lib/api/payment.ts` |
| POST | `/payments/{}/sync` | `lib/api/payment.ts` |
| POST | `/posts` | `lib/api/feed.ts` |
| POST | `/posts/{}/comments` | `lib/api/feed.ts` |
| POST | `/posts/{}/publish` | `lib/api/feed.ts` |
| POST | `/posts/{}/schedule` | `lib/api/feed.ts` |
| POST | `/public/banners/{}/events` | `lib/api/banners.ts` |
| POST | `/public/referrals/click` | `lib/api/referral.ts` |
| POST | `/reports` | `lib/api/reports.ts` |
| POST | `/safe-deals/{}/cancel` | `lib/api/safe-deals.ts` |
| POST | `/safe-deals/{}/confirm` | `lib/api/safe-deals.ts` |
| POST | `/safe-deals/{}/delivered` | `lib/api/safe-deals.ts` |
| POST | `/safe-deals/{}/dispute` | `lib/api/safe-deals.ts` |
| POST | `/safe-deals/{}/review` | `lib/api/safe-deals.ts` |
| POST | `/safe-deals/{}/ship` | `lib/api/safe-deals.ts` |
| POST | `/users/me/notifications/read-all` | `lib/api/notifications.ts` |
| POST | `/users/me/notifications/{}/read` | `lib/api/notifications.ts` |
| POST | `/users/me/presence` | `lib/presence-heartbeat.ts` |
| POST | `/users/me/referrals/claim` | `lib/api/referral.ts` |
| POST | `/users/me/reviews/{}/reply` | `lib/api/rating.ts` |
| POST | `/users/me/subscription/cancel` | `lib/api/payment.ts` |
| POST | `/users/{}/block` | `lib/api/social.ts` |
| POST | `/users/{}/follow` | `lib/api/social.ts` |
| POST | `/users/{}/friend-request` | `lib/api/social.ts` |
| POST | `/videos` | `lib/api/reviews.ts` |
| POST | `/videos/{}/comments` | `lib/api/reviews.ts` |
| POST | `/videos/{}/react` | `lib/api/reviews.ts` |
| POST | `/videos/{}/schedule` | `lib/api/reviews.ts` |
| POST | `/videos/{}/view` | `lib/api/reviews.ts` |
| POST | `/wallet/topup` | `lib/api/wallet.ts` |
| POST | `/wallet/withdraw` | `lib/api/wallet.ts` |
| PUT | `/account/payout-requisites` | `lib/api/payout-requisites.ts` |
| PUT | `/account/requisites` | `lib/api/account.ts` |
| PUT | `/admin/feed/guest-access` | `lib/api/feed-guest-access.ts` |
| PUT | `/admin/footer-links/{}` | `lib/api/legal.ts` |
| PUT | `/admin/legal-pages/{}` | `lib/api/legal.ts` |
| PUT | `/admin/notifications/policy` | `lib/api/notification-policy.ts` |
| PUT | `/admin/rule-pages/{}` | `lib/api/rules.ts` |

## Фронт зовёт несуществующее — 17

| Метод | Путь | Где вызывается |
|---|---|---|
| DELETE | `/admin/categories/{}/{}` | `lib/api/admin.ts` |
| GET | `/admin/media${q ` | `lib/api/admin-media.ts` |
| GET | `/channels/{}/posts/{}/like` | `lib/channels.ts` |
| GET | `/channels/{}/posts/{}/pin` | `lib/channels.ts` |
| GET | `/channels/{}/subscribe` | `lib/channels.ts` |
| GET | `/posts/{}/bookmark` | `lib/api/feed.ts` |
| GET | `/posts/{}/react` | `lib/api/feed.ts` |
| GET | `/posts/{}/repost` | `lib/api/feed.ts` |
| POST | `/admin/categories/{}` | `lib/api/admin.ts` |
| POST | `/admin/icon-media{}` | `lib/api/icons.ts` |
| POST | `/admin/{}/applications/{}/approve` | `lib/api/entity-requests.ts` |
| POST | `/admin/{}/applications/{}/reject` | `lib/api/entity-requests.ts` |
| POST | `/communities/{}/join-requests/{}/{}` | `lib/api/communities.ts` |
| POST | `/footer-links` | `lib/api/legal.ts` |
| POST | `/me/consents` | `lib/api/legal.ts` |
| POST | `/users/{}/reviews` | `lib/api/rating.ts` |
| PUT | `/admin/categories/{}/{}` | `lib/api/admin.ts` |

## Эндпоинт есть, фронт не использует — 118


**account** (6)

- `GET /account/payment-methods/bind/complete`
- `POST /account/2fa/disable`
- `POST /account/2fa/setup`
- `POST /account/2fa/verify`
- `POST /account/change-email`
- `POST /account/confirm-email`

**admin** (53)

- `DELETE /admin/categories/community/{}`
- `DELETE /admin/categories/listing/{}`
- `DELETE /admin/categories/post/{}`
- `DELETE /admin/categories/video/{}`
- `DELETE /admin/communities/{}`
- `GET /admin/audit-logs`
- `GET /admin/categories/community`
- `GET /admin/categories/community/{}`
- `GET /admin/categories/listing`
- `GET /admin/categories/listing/{}`
- `GET /admin/categories/post`
- `GET /admin/categories/post/{}`
- `GET /admin/categories/video`
- `GET /admin/categories/video/{}`
- `GET /admin/communities`
- `GET /admin/communities/{}`
- `GET /admin/delivery/shipments`
- `GET /admin/feedback`
- `GET /admin/icon-media`
- `GET /admin/listings`
- `GET /admin/moderation/queue`
- `GET /admin/payments`
- `GET /admin/payments/export`
- `GET /admin/plans`
- `GET /admin/posts`
- `GET /admin/reports`
- `GET /admin/safe-deals/export`
- `GET /admin/users`
- `GET /admin/users/{}/payout-requisites`
- `GET /admin/videos`
- `GET /admin/wallets/{}`
- `PATCH /admin/categories/community/{}`
- `PATCH /admin/categories/listing/{}`
- `PATCH /admin/categories/post/{}`
- `PATCH /admin/categories/video/{}`
- `PATCH /admin/communities/{}`
- `POST /admin/categories/community`
- `POST /admin/categories/listing`
- `POST /admin/categories/post`
- `POST /admin/categories/video`
- `POST /admin/channels/applications/{}/approve`
- `POST /admin/channels/applications/{}/reject`
- `POST /admin/communities`
- `POST /admin/communities/applications/{}/approve`
- `POST /admin/communities/applications/{}/reject`
- `POST /admin/delivery/methods/reorder`
- `POST /admin/plans`
- `POST /admin/users`
- `PUT /admin/categories/community/{}`
- `PUT /admin/categories/listing/{}`
- `PUT /admin/categories/post/{}`
- `PUT /admin/categories/video/{}`
- `PUT /admin/communities/{}`

**auth** (3)

- `GET /auth/oauth/{}/callback`
- `GET /auth/oauth/{}/redirect`
- `POST /auth/consent`

**broadcasting** (2)

- `GET /broadcasting/auth`
- `POST /broadcasting/auth`

**categories** (3)

- `GET /categories/posts/rooms/stats`
- `GET /categories/posts/{}/rooms/stats`
- `GET /categories/posts/{}/rooms/{}/members`

**comments** (1)

- `GET /comments/{}/thread`

**communities** (5)

- `GET /communities`
- `GET /communities/{}/join-requests`
- `GET /communities/{}/members`
- `POST /communities/{}/join-requests/{}/approve`
- `POST /communities/{}/join-requests/{}/reject`

**delivery** (5)

- `GET /delivery/cdek/cities`
- `GET /delivery/yandex/pickup-points`
- `POST /delivery/cdek/quote`
- `POST /delivery/yandex/location/detect`
- `POST /delivery/yandex/quote`

**feed** (1)

- `GET /feed`

**health** (1)

- `GET /health`

**listings** (1)

- `POST /listings/ai-suggest`

**me** (1)

- `GET /me/data/export`

**media** (3)

- `GET /media/{}`
- `GET /media/{}/{}`
- `POST /media/upload-session`

**payments** (2)

- `GET /payments/webhooks/vtb`
- `POST /payments/webhooks/vtb`

**safe-deals** (4)

- `GET /safe-deals/webhooks/vtb`
- `POST /safe-deals/webhooks/delivery`
- `POST /safe-deals/webhooks/vtb`
- `POST /safe-deals/webhooks/vtb-payout`

**shipments** (9)

- `GET /shipments`
- `GET /shipments/{}`
- `PATCH /shipments/{}`
- `POST /shipments`
- `POST /shipments/{}/cancel`
- `POST /shipments/{}/confirm`
- `POST /shipments/{}/quote`
- `POST /shipments/{}/request-seller`
- `POST /shipments/{}/sync`

**tags** (1)

- `GET /tags`

**users** (13)

- `DELETE /users/me/delivery-profile/{}`
- `GET /users/me/blocks`
- `GET /users/me/delivery-profile`
- `GET /users/me/favorites`
- `GET /users/me/friends`
- `GET /users/me/interests`
- `GET /users/me/listings`
- `GET /users/search`
- `GET /users/{}/listings`
- `PATCH /users/me/delivery-profile/{}`
- `PATCH /users/me/privacy`
- `POST /users/me/delivery-profile`
- `PUT /users/me/interests`

**videos** (1)

- `GET /videos/categories`

**webhooks** (3)

- `POST /webhooks/cdek/order-status`
- `POST /webhooks/max`
- `POST /webhooks/yandex/delivery-status`
