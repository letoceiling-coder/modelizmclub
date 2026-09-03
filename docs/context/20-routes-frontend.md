# 20 — Маршруты фронта

76 файлов маршрутов в `frontend/src/routes`, срез `origin/master` @ `ecb4d60`.

## Читать до таблицы: защита маршрутов существует только на клиенте

Все гварды живут в `frontend/src/lib/auth/` и начинаются одинаково:

```ts
// frontend/src/lib/auth/requireAuth.ts:30
export async function requireAuth(location?): Promise<void> {
  if (typeof window === "undefined") return;   // на SSR не срабатывает
  if (isDemoMode()) return;                    // в demo не срабатывает
  const ok = await ensureSession();
  if (!ok) throw redirect({ to: "/login", ... });
}
```

Из этого следует три вещи:

1. **На SSR гвард не работает** — сервер отрисовывает страницу целиком, редирект
   происходит уже в браузере после гидратации. Содержимое страницы попадает в
   HTML-ответ независимо от того, авторизован ли посетитель.
2. **В demo-режиме открыты все маршруты** без исключений.
3. Настоящей границей доступа является **API**, а не маршрут. Разбор того, как
   она устроена на бэкенде, — в `21-routes-api.md`.

Доступные гварды: `requireAuth`, `requireAdmin`, `requireVerified`,
`requirePremium`, `requireGuestRouteAccess`, `redirectIfAuthenticated`,
`enforceClientRouteAccess`.

## Почему так много «???»

**58 из 76 маршрутов** не содержат в файле маршрута никакого гварда. Это не
означает, что они публичные — уровень доступа для них просто **не определён в
коде маршрута** и может проверяться:

- внутри компонента (условный рендер, диалог авторизации);
- на уровне API — запрос вернёт 401/403, а UI покажет пустое состояние;
- нигде.

Различить эти три случая по файлу маршрута нельзя, поэтому в таблице стоит
`???`, как и было условлено. Чтобы снять пометку, нужна матрица доступов из
мастер-контекста — её в переданных материалах нет.

## Таблица

| Путь | Файл | Компонент | Уровень доступа | Как реализована защита |
|---|---|---|---|---|
| `(root)` | `__root.tsx` | `RootComponent` | guest-only | requireGuestRouteAccess |
| `/` | `index.tsx` | `LandingPage` | **???** | нет защиты в маршруте |
| `/admin` | `admin.tsx` | `AdminPage` | admin | requireAdmin |
| `/admin/design-system` | `admin.design-system.tsx` | `DesignSystemPage` | registered | requireAuth + 404 в проде |
| `/admin/listings/$uuid` | `admin.listings.$uuid.tsx` | `AdminListingPage` | admin | requireAdmin |
| `/ads` | `ads.tsx` | `—` | **???** | нет защиты в маршруте |
| `/ads/` | `ads.index.tsx` | `CatalogPage` | **???** | нет защиты в маршруте |
| `/ads/$id` | `ads.$id.tsx` | `AdDetailPage` | registered | requireAuth |
| `/ads/new` | `ads.new.tsx` | `NewAdPage` | verified | requireVerified |
| `/auth` | `auth.tsx` | `—` | **???** | beforeLoad без известного гварда |
| `/balance` | `balance.tsx` | `—` | **???** | beforeLoad без известного гварда |
| `/categories` | `categories.tsx` | `—` | **???** | нет защиты в маршруте |
| `/categories/` | `categories.index.tsx` | `CategoriesPage` | **???** | нет защиты в маршруте |
| `/categories/$id` | `categories.$id.tsx` | `—` | **???** | нет защиты в маршруте |
| `/categories/$id/` | `categories.$id.index.tsx` | `CategoryRoomsPage` | **???** | нет защиты в маршруте |
| `/categories/$id/$subId` | `categories.$id.$subId.tsx` | `SubcategoryRoomPage` | **???** | нет защиты в маршруте |
| `/channel/$id` | `channel.$id.tsx` | `ChannelPage` | subscriber | requirePremium |
| `/channels/` | `channels.index.tsx` | `ChannelsPage` | subscriber | requirePremium |
| `/channels/new` | `channels.new.tsx` | `ChannelNewPage` | subscriber | requirePremium |
| `/communities` | `communities.tsx` | `—` | **???** | beforeLoad без известного гварда |
| `/communities/` | `communities.index.tsx` | `CommunitiesPage` | **???** | нет защиты в маршруте |
| `/communities/$id` | `communities.$id.tsx` | `CommunityDetailPage` | subscriber | requirePremium |
| `/communities/new` | `communities.new.tsx` | `CommunityNewPage` | subscriber | requirePremium |
| `/deals` | `deals.tsx` | `DealsRoute` | **???** | нет защиты в маршруте |
| `/deals/$uuid` | `deals.$uuid.tsx` | `DealDetailRoute` | **???** | нет защиты в маршруте |
| `/diag` | `diag.tsx` | `DiagPage` | admin | requireAdmin |
| `/favorites` | `favorites.tsx` | `FavoritesPage` | **???** | нет защиты в маршруте |
| `/feed` | `feed.tsx` | `FeedPage` | **???** | нет защиты в маршруте |
| `/friends` | `friends.tsx` | `FriendsPage` | verified | requireVerified |
| `/help` | `help.tsx` | `HelpPage` | **???** | нет защиты в маршруте |
| `/how-it-works` | `how-it-works.tsx` | `HowItWorksPage` | **???** | нет защиты в маршруте |
| `/info/$slug` | `info.$slug.tsx` | `InfoPage` | **???** | нет защиты в маршруте |
| `/landing` | `landing.tsx` | `—` | **???** | beforeLoad без известного гварда |
| `/legal/$slug` | `legal.$slug.tsx` | `LegalPage` | **???** | нет защиты в маршруте |
| `/login` | `login.tsx` | `LoginPage` | registered | requireAuth, redirectIfAuthenticated |
| `/messenger` | `messenger.tsx` | `MessengerRoute` | verified | requireVerified |
| `/my-ads` | `my-ads.tsx` | `MyAdsPage` | **???** | нет защиты в маршруте |
| `/notifications` | `notifications.tsx` | `NotificationsPage` | **???** | нет защиты в маршруте |
| `/oauth/vk/callback` | `oauth.vk.callback.tsx` | `VkOAuthCallbackPage` | **???** | нет защиты в маршруте |
| `/onboarding` | `onboarding.tsx` | `OnboardingPage` | **???** | нет защиты в маршруте |
| `/pay/stub/$uuid` | `pay.stub.$uuid.tsx` | `StubAcquiringPage` | **???** | нет защиты в маршруте |
| `/payment` | `payment.tsx` | `PaymentPage` | **???** | нет защиты в маршруте |
| `/profile` | `profile.tsx` | `ProfilePage` | **???** | нет защиты в маршруте |
| `/r/$code` | `r.$code.tsx` | `ReferralShortLinkPage` | **???** | нет защиты в маршруте |
| `/recover` | `recover.tsx` | `RecoverPage` | **???** | нет защиты в маршруте |
| `/referral` | `referral.tsx` | `ReferralPage` | **???** | нет защиты в маршруте |
| `/refund` | `refund.tsx` | `RefundPage` | **???** | нет защиты в маршруте |
| `/register` | `register.tsx` | `RegisterPage` | **???** | нет защиты в маршруте |
| `/reset-password` | `reset-password.tsx` | `ResetPasswordPage` | **???** | нет защиты в маршруте |
| `/reviews` | `reviews.tsx` | `ReviewsSection` | **???** | beforeLoad без известного гварда |
| `/reviews/` | `reviews.index.tsx` | `ReviewsPage` | **???** | нет защиты в маршруте |
| `/reviews/$id` | `reviews.$id.tsx` | `WatchPage` | subscriber | requirePremium |
| `/reviews/upload` | `reviews.upload.tsx` | `UploadPage` | admin | requireAdmin |
| `/rules` | `rules.tsx` | `—` | **???** | нет защиты в маршруте |
| `/rules/` | `rules.index.tsx` | `RulesHubPage` | **???** | нет защиты в маршруте |
| `/rules/$slug` | `rules.$slug.tsx` | `RuleDocumentPage` | **???** | нет защиты в маршруте |
| `/safe-deal` | `safe-deal.tsx` | `—` | **???** | beforeLoad без известного гварда |
| `/safe-deals` | `safe-deals.tsx` | `—` | **???** | beforeLoad без известного гварда |
| `/settings` | `settings.tsx` | `SettingsLayout` | **???** | нет защиты в маршруте |
| `/settings/` | `settings.index.tsx` | `SettingsIndex` | **???** | нет защиты в маршруте |
| `/settings/account` | `settings.account.tsx` | `AccountSection` | **???** | нет защиты в маршруте |
| `/settings/appearance` | `settings.appearance.tsx` | `AppearanceSection` | **???** | нет защиты в маршруте |
| `/settings/consents` | `settings.consents.tsx` | `ConsentsSettingsPage` | **???** | нет защиты в маршруте |
| `/settings/dashboard` | `settings.dashboard.tsx` | `DashboardSection` | **???** | нет защиты в маршруте |
| `/settings/history` | `settings.history.tsx` | `HistorySection` | **???** | нет защиты в маршруте |
| `/settings/notifications` | `settings.notifications.tsx` | `NotificationsSettings` | **???** | нет защиты в маршруте |
| `/settings/payment-methods` | `settings.payment-methods.tsx` | `PaymentMethodsSection` | **???** | нет защиты в маршруте |
| `/settings/rating` | `settings.rating.tsx` | `RatingSection` | **???** | нет защиты в маршруте |
| `/settings/requisites` | `settings.requisites.tsx` | `RequisitesSection` | **???** | нет защиты в маршруте |
| `/settings/security` | `settings.security.tsx` | `SecuritySection` | **???** | нет защиты в маршруте |
| `/settings/spaces` | `settings.spaces.tsx` | `SettingsSpacesPage` | **???** | нет защиты в маршруте |
| `/settings/wallet` | `settings.wallet.tsx` | `WalletSection` | **???** | нет защиты в маршруте |
| `/subscription` | `subscription.tsx` | `SubscriptionPage` | verified | requireVerified, requireAuth |
| `/user/$id` | `user.$id.tsx` | `UserPage` | **???** | нет защиты в маршруте |
| `/verify-email` | `verify-email.tsx` | `VerifyEmailPage` | **???** | нет защиты в маршруте |
| `/wallet` | `wallet.tsx` | `—` | **???** | beforeLoad без известного гварда |

### Сводка

| Уровень | Маршрутов |
|---|---:|
| **???** | 58 |
| subscriber | 6 |
| admin | 4 |
| verified | 4 |
| registered | 3 |
| guest-only | 1 |

Всего файлов маршрутов: **76**

## Отдельные наблюдения

**`/admin/design-system`** — единственный маршрут, который в проде отдаёт 404:

```ts
// admin.design-system.tsx:18
if (import.meta.env.PROD) throw notFound();
```

После этой строки идёт `requireAuth`, а не `requireAdmin`, но в проде до неё
не доходит. В dev-сборке страница доступна любому авторизованному.

**`/ads/new`** защищён `requireVerified`, а не `requireAuth` — то есть требует
подтверждённого аккаунта, а не просто входа. Это самый строгий гвард среди
пользовательских маршрутов.

**Шесть маршрутов с `requirePremium`** — единственное место, где в коде
маршрутов выражена подписка.

**`/ads` и `/ads/`** — два разных файла (`ads.tsx` — layout, `ads.index.tsx` —
страница каталога), оба без гварда.
