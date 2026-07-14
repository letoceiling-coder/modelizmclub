# Настройки (Personal Cabinet) — Design Spec

## Context

ModelizmClub has no unified "Настройки" area. Account-adjacent functionality is scattered: `/profile` holds public-profile editing (avatar, name, city, bio, interests) plus tabs; `/subscription` manages the plan; `/notifications` is a **received-notifications feed** (not preference toggles); `/my-ads` manages listings. There is no place to change password/email, toggle notification preferences, view a wallet, enter deal-document requisites, see your rating, or review browsing history.

This spec adds a **Настройки** section: one new sidebar item that opens a nested master-detail structure of settings sub-sections, mobile-first. It also improves the sidebar subscription block to show the end date.

Reference model: Avito's личный кабинet (the relevant subset only — see Non-goals).

## Goals

1. One new "Настройки" nav item (sidebar + mobile "..." menu), at the end of the primary nav, before the subscription block. The existing nav list is otherwise **untouched**.
2. Nested `/settings/*` routes: an index list of sections; each section is its own route. Mobile = full-screen list → detail with native back. Desktop = two-column (persistent section rail + content).
3. Seven sub-sections with working demo UI now; every real-backend dependency documented as backend-track in `backend-endpoints-needed.md` (new entry #24).
4. Add cover-image upload to `/profile` (currently display-only) — the one profile-management gap.
5. Sidebar subscription block shows the end date (compact, two-line format).

## Non-goals

- **Not** changing any existing primary nav item (Лента / Каталог / Разместить / Мои объявления / Избранное / Обзоры / Каналы / Мессенджер / Друзья / Маркет).
- **Not** building B2B Avito features: Сотрудники, Интеграции/API, личные адреса доставки, Заказы/Бронирования, платное продвижение/аналитика, реквизиты нескольких юрлиц.
- **Not** implementing real backend for password/email/notifications/wallet/requisites/ratings/view-history — those are demo UI now, documented for backend.
- **Not** duplicating listing management — "Мои объявления" in settings is a link to the existing `/my-ads`.
- **Not** touching the `/notifications` feed page — the new notification **toggles** are a separate settings sub-section.

## Architecture

### Routing (TanStack file-based routes)

```
settings.tsx            → layout: renders <SettingsNav/> + <Outlet/>, wraps in AppLayout, requireAuth
settings.index.tsx      → the section list (mobile: full-screen list; desktop: placeholder in content pane)
settings.account.tsx    → Профиль и аккаунт (password/email demo forms + link to /profile)
settings.notifications.tsx → Уведомления (toggles, localStorage)
settings.wallet.tsx     → Кошелёк (balance + operations, demo)
settings.requisites.tsx → Реквизиты (form, localStorage)
settings.rating.tsx     → Рейтинг и отзывы (demo)
settings.history.tsx    → История просмотров (localStorage)
```

All routes are auth-gated via the existing pattern (`beforeLoad` → `requireAuth`), mirroring `/profile`, `/friends`, `/notifications`.

Note: "Мои объявления" is **not** a route here — it is a list row in `settings.index.tsx` / `SettingsNav` that navigates to `/my-ads`.

### Master-detail layout (`settings.tsx`)

`SettingsNav` is the list of sections: `{ to, labelKey, icon }[]` plus the external "Мои объявления → /my-ads" row. Each row: icon + label + `ChevronRight` (matching `CategoryCard` style).

- **Desktop (lg+):** two-column grid — `SettingsNav` in a left rail (~240px, sticky), `<Outlet/>` on the right. Active section row highlighted via `useRouterState` pathname match. At `/settings` (index), the right pane shows a muted "Выберите раздел настроек" placeholder.
- **Mobile (<lg):** single column. At `/settings` (index) the `SettingsNav` list fills the screen and `<Outlet/>` (the index) is empty/placeholder. At a child route, `SettingsNav` is hidden and the child content fills the screen with a back header ("← Настройки", a `Link to="/settings"`). Determine "is a child active" via `useRouterState` (`pathname !== "/settings"`).

Concretely: `settings.tsx` computes `const atIndex = pathname === "/settings"`. Renders:
- Left rail: `className="hidden lg:block ..."` always; plus on mobile shown only when `atIndex` (so the index list is the nav itself — `settings.index.tsx` renders the same `SettingsNav` for mobile, OR the layout renders the nav and the index is empty). **Decision:** the layout renders `SettingsNav` responsively (desktop always; mobile only when `atIndex`), and `settings.index.tsx` renders only the desktop right-pane placeholder. The child routes render their own content + a mobile-only back header.

### State & persistence

Reuse the existing localStorage pattern already used by `featureFlags.ts` (a typed getter/setter + `useSyncExternalStore` or simple `useState` seeded from `localStorage`). For settings we do not need cross-tab reactivity, so a simpler `useState(() => readLS(key, default))` + write-on-change is sufficient. Keys:
- `modelizm_notif_prefs` — notification toggle booleans
- `modelizm_requisites` — requisites form object
- `modelizm_view_history` — array of recently-viewed items (capped)

Wallet, rating, and operations history are **static demo data** in `lib/mock.ts` (no persistence needed — read-only display).

## Sub-sections (detail)

### 1. Профиль и аккаунт — `/settings/account`

- **Смена пароля** (demo): form with `current password`, `new password`, `confirm new password`. Client validation: new ≥ 8 chars, confirm matches. Submit → `toast("Смена пароля: будет доступно позже")` (stub, no API). No real submission.
- **Смена email** (demo): form with `new email`, client email-format validation. Submit → `toast("Смена email: будет доступно позже")`.
- **Редактировать публичный профиль** row → `Link to="/profile"` (avatar, cover, name, city, bio, interests are edited there).

### 2. Уведомления — `/settings/notifications`

Toggle list, each row = label + a switch. Types: `friend_requests`, `comments`, `likes`, `messages`, `subscription_posts`. State in `localStorage` (`modelizm_notif_prefs`), default all `true`. Toggling updates localStorage immediately; no toast needed (the switch is its own feedback). A one-line muted note at the top: "Настройки применяются на этом устройстве. Реальная доставка — в разработке."

Reuse the existing UI Kit switch component if present; otherwise a styled checkbox toggle consistent with the design system. (Implementer verifies whether a `Switch`/`Toggle` exists in `components/ui/`.)

### 3. Кошелёк — `/settings/wallet`

- Balance card: large number + "₽" + a muted "Демо-баланс" label.
- Operations history: list of demo transactions (`{ id, type: "in"|"out", amount, title, date }`), each row shows title, date, and signed amount (green for in, default for out). Static data from `lib/mock.ts` (`mockWalletBalance`, `mockWalletOperations`).
- No top-up/withdraw actions in v1 (backend-track).

### 4. Мои объявления — link only

Row in `SettingsNav` → navigates to `/my-ads`. No route, no duplicated functionality.

### 5. Реквизиты для документов сделок — `/settings/requisites`

Simple form, **no payment validation**: fields `Полное имя (ФИО)`, `ИНН` (optional), `Телефон`, `Адрес`. Save → write to `localStorage` (`modelizm_requisites`) + `toast.success("Реквизиты сохранены")`. Pre-fill from localStorage on mount. Muted note: "Данные хранятся локально. Интеграция с документами сделок — в разработке."

### 6. Рейтинг и отзывы — `/settings/rating`

- Your average rating: big star value (e.g. `4.8`) + star row + count ("на основе N отзывов"). Demo data from `lib/mock.ts` (`mockMyRating`).
- Received reviews list: `{ id, author, avatar, rating, text, date }[]` (demo, `mockMyReviews`), each rendered as a compact card (avatar, name, star rating, text, relative date).
- Read-only in v1 (no reply/dispute — backend-track).

### 7. История просмотров — `/settings/history`

- "Недавно просмотренное" list from `localStorage` (`modelizm_view_history`): `{ id, kind: "ad"|"profile"|"review", title, thumb?, viewedAt }[]`, newest first, capped at 50.
- Each row links to the item (`/ads/$id`, `/user/$id`, `/reviews/$id` by `kind`).
- Empty state (`EmptyState`) when no history: "Пока пусто — просмотренные объявления и профили появятся здесь".
- A "Очистить историю" button clears the localStorage key.
- **v1 scope note:** this section *displays and clears* history. Wiring every ad/profile/review page to *record* views is out of scope for this spec (would touch many unrelated routes); the spec adds a tiny `recordView(item)` helper in `lib/view-history.ts` and wires it into **only** the ad detail (`/ads/$id`) and review watch (`/reviews/$id`) pages as representative producers, so the list is demonstrably non-empty in real use. Broader instrumentation is backend-track (server-side personalization).

## Profile cover upload (extension to `/profile`)

`/profile`'s `CoverImage` is display-only. Add an edit affordance for the owner (`isOwn`), mirroring the existing `ProfileAvatar` edit pattern (which already uses `uploadMedia(file, "avatar")` + `updateOwnProfile({ avatar_media_id })` + `setCurrentUser`):

- Add a camera button overlay on the cover (owner only), opening a file picker.
- On select: `uploadMedia(file, "cover")` → `setCurrentUser({ ...currentUser, coverImage: url })` → `void updateOwnProfile({ cover_media_id: media.uuid })`.
- Verify `MediaPurpose` includes `"cover"`; if not, add it to the `MediaPurpose` union in `lib/api/media.ts` (same one-line addition pattern used for `"review_video"`).
- Verify `updateOwnProfile` accepts `cover_media_id`; if the real endpoint doesn't yet, the demo branch stores it locally and the field is documented in backend entry #24. (Implementer checks `lib/api/social.ts`.)

## Nav integration

### Sidebar (`components/layout/Sidebar.tsx`)

- Add `settings: "/settings"` to `ROUTES` and `settings: ["/settings"]` to `SIDEBAR_ROUTE_MAP`.
- Add one `ALL_ITEMS` entry **at the end of the array** (after `friends`): `{ to: ROUTES.settings, labelKey: "nav.settings", icon: Settings, section: "settings", authOnly: true }` (lucide `Settings` gear icon). This renders after Друзья and before the Market link / subscription block. No other list change. `authOnly: true` because settings require a session.

### Mobile "..." menu (`components/layout/MobileHeader.tsx`)

Add a "Настройки" row to `MoreMenu` (same `Link` pattern as the existing Channels/Reviews rows), gear icon, `to="/settings"`, closing the drawer on click. Placed after the Reviews row, before the theme toggle.

### i18n

Add `nav.settings` to all three locales (`ru.ts`: "Настройки", `en.ts`: "Settings", `zh.ts`: "设置").

## Sidebar subscription block — end date (Variant B)

Currently the block shows only `t("common.subscriptionActive")` ("Год · активна"). Change to a two-line compact format:
- Line 1 (unchanged): `Год · активна` (`common.subscriptionActive`).
- Line 2 (new, small + muted): `до 15 июля 2027` — the end date.

`subscriptionEndDate()` already exists in `routes/subscription.tsx` (module-private, `SUB_DAYS_LEFT = 287`, `toLocaleDateString("ru-RU", { day:"numeric", month:"long", year:"numeric" })`). Extract it to a shared helper `lib/subscription.ts` (`export function subscriptionEndDate(): string`) and import it in both `subscription.tsx` and `Sidebar.tsx` — no behavior change to the subscription page, single source of truth. Add an i18n key `common.subscriptionUntil` = `"до {{date}}"` (ru) / `"until {{date}}"` (en) / `"至 {{date}}"` (zh) for the second line prefix, or inline the "до " — implementer's choice consistent with existing i18n usage. The block's size and position in the sidebar are unchanged (the second line is a small addition inside the existing card).

## Demo vs backend-track split

**Working demo now (this spec):** all seven sections' UI, localStorage persistence (notif prefs, requisites, view history), static demo data (wallet, rating), cover upload (demo/local branch), sidebar end date, nav integration.

**Backend-track (new entry #24 in `frontend/docs/backend-endpoints-needed.md`):**
- `POST /account/change-password` (current + new password)
- `POST /account/change-email` + verification flow
- `GET/PUT /account/notification-preferences` (per-type booleans + delivery)
- `GET /wallet` (balance) + `GET /wallet/transactions`
- `PUT /account/requisites` (persist deal-document requisites)
- `GET /users/{id}/reviews` + rating aggregate (real ratings & reviews)
- Server-side view history / personalization (`GET /me/view-history`)
- `updateOwnProfile` accepting `cover_media_id` (if not already supported)

Each documented with method/path/auth/payload/response shape, following the existing doc conventions.

## Testing

No unit-test framework in this repo — verification is `npx tsc --noEmit` + live Playwright checks at 375px and desktop, per project convention.

Verification plan:
- `tsc` clean.
- **Mobile 375px:** `/settings` shows the full-screen section list; tapping a section opens it full-screen with a working back link to `/settings`; browser back returns to the list; "Мои объявления" row navigates to `/my-ads`; "..." menu has a working "Настройки" row.
- **Desktop:** two-column layout — rail + content; active section highlighted; index shows placeholder.
- **Per-section:** password/email forms validate + toast-stub on submit; notification toggles persist across reload (localStorage); wallet shows balance + operations; requisites save + pre-fill on reload; rating shows stars + reviews; view-history shows recorded items (visit an ad detail then check history), links work, "Очистить" empties it.
- **Profile cover:** owner sees cover edit affordance; upload swaps the cover; non-owner sees no edit control.
- **Sidebar subscription:** two-line block with end date, same size/position; `/subscription` page still renders its own end date identically (shared helper).
- No new console errors on any settings route.
