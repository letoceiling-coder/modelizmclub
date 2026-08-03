# Modelizm Club — матрица 43 атомарных задач (PDF modelizm-test)

Источник: [`modelizm-test.pdf`](./modelizm-test.pdf)  
Baseline: [`modelizm-baseline.md`](./modelizm-baseline.md)  
Статусы: `TODO` | `REPRODUCED` | `IN_PROGRESS` | `FIXED` | `VERIFIED` | `BLOCKED`

---

## Этап A — Общие компоненты и критические дефекты

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 1 | №1, №15, №19 | `/feed`, `/ads/new`, `/channel/*` | Media upload | P1 | code review | Fixed 5-col grid + overlay buttons; no i18n | — | `ImageUploadGrid.tsx`, `CreatePostForm`, `channel.$id` | — | build pass | VERIFIED | VERIFIED | FIXED |
| 2 | №2 | `/feed` | Post draft | P2 | code review | Vertical banner + long copy took too much space | — | `CreatePostForm.tsx`, i18n | — | — | VERIFIED | VERIFIED | FIXED |
| 3 | №3 | `/feed` | Post title | P2 | code review | BE max:200, FE без лимита и счётчика | `PostFormRules`, Store/UpdatePostRequest | `CreatePostForm`, `post-limits.ts`, `PostCard` | — | unit test | VERIFIED | VERIFIED | FIXED |
| 4 | №4 | `/feed` | Feed filters | P2 | code review | grid 2×3 на mobile, высокие chips | — | `FeedFilterTabs.tsx` | — | — | VERIFIED | VERIFIED | FIXED |
| 5 | №5 | `/feed` | Moderation | **P0** | code review | bookmark без проверки status; FE не disabled | `PostInteractionRules`, services | `PostCard`, `PostActionMenu`, `RepostMenu` | — | unit + feature (VPS) | VERIFIED | VERIFIED | FIXED |
| 6 | №7 | `/messenger` | Chat delivery | **P0** | FIXED | WS message dropped when dialog missing from store | `ChatService`, WS | `store.ts` ingestIncomingMessage | — | — | — | — | FIXED |
| 7 | №9 | `/notifications` | Notifications | P1 | FIXED | delayed delete lost on unmount/refresh; sessionStorage flush + API persist | `NotificationController` | `notifications.tsx`, pending-delete helper | — | NotificationDeleteTest | VERIFIED | VERIFIED | FIXED |
| 8 | №10 | `/profile` | Profile edit | P1 | FIXED | EditSheet clipped inside main overflow; mobile animation mismatch on first paint | Profile API | `profile.tsx` EditSheet portal, `use-mobile` | — | build pass | VERIFIED | VERIFIED | FIXED |
| 9 | №21 | `/admin`, nav | Settings | P1 | FIXED | toggle saved but landing/search/routes ignored flag; sidebar already wired | `FeatureFlagsController`, `SystemSetting` | `featureFlags`, nav, `communities` route guard | — | FeatureFlagsTest | VERIFIED | VERIFIED | FIXED |
| 10 | №32 | `/ads/*` | Listing moderation | **P0** | FIXED | update() skipped re-moderation gate | `ListingService::update()` | `ads.new.tsx` edit toast | — | feature tests | — | — | FIXED |

---

## Этап B — Feed, Messenger, Notifications, Profile, Ads UI

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 11 | №28 | `/feed`, `/admin` | Banner | P1 | FIXED | min-h regression from `6b84d85`; restored fixed h + line-clamp | Banner limits | `BannerHeroSlide`, `EventsHero`, admin preview | — | build pass | VERIFIED | VERIFIED | FIXED |
| 12 | №29 | `/feed` | Comments | P1 | FIXED | comments only on expand + gated by canInteract; no inline preview | `PostCommentsController` | `PostCard`, `CommentSection` | — | build pass | VERIFIED | VERIFIED | FIXED |
| 13 | №6 | `/messenger` | Calls | P1 | FIXED | incoming-call toast at bottom overlapped Accept/Decline; Sonner z-index above call screen | — | `calls.ts`, `CallScreen`, `styles.css` | — | build pass | VERIFIED | VERIFIED | FIXED |
| 14 | №13 | `/messenger` | Presence | P2 | code review | status text wrapped in chat header | — | `messenger.tsx` truncate + nowrap | — | build pass | VERIFIED | VERIFIED | FIXED |
| 15 | №14 | `/messenger` | Media bubbles | P2 | code review | voice/image bubbles too large (280px) | — | `VoiceBubble`, `MessageFileBubble`, `messenger.tsx` 240px | — | build pass | VERIFIED | VERIFIED | FIXED |
| 16 | №8 | `/notifications` | Layout | P2 | code review | header overflow at 320px | — | `notifications.tsx` stacked header, icon buttons | — | build pass | VERIFIED | VERIFIED | FIXED |
| 17 | №11 | `/profile` | Tabs | P2 | code review | profile tabs cramped on mobile | — | `profile.tsx` horizontal scroll + compact padding | — | build pass | VERIFIED | VERIFIED | FIXED |
| 18 | №12 | `/profile` | Ad cards | P2 | code review | date wrapped in compact ad card meta | — | `AdCard.tsx` stacked meta in compact | — | build pass | VERIFIED | VERIFIED | FIXED |
| 19 | №16, №31 | `/ads/new` | CTA | **P0** | FIXED | Icon-only CTA + clipped label on mobile preview step | listing publish API | `ads.new.tsx` footer CTA | — | — | VERIFIED | VERIFIED | FIXED |
| 20 | №33 | `/ads/$id` (owner) | Owner panel | P2 | code review | stats grid cramped on narrow screens | — | `AdOwnerActionPanel` 2-col stats on mobile | — | build pass | VERIFIED | VERIFIED | FIXED |

---

## Этап C — Каналы

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 21 | №17 | `/channels` | Channel owner UI | P2 | code review | owner actions already inline on MyChannelCard | permissions | `channels.index.tsx` MyChannelCard settings/stats/delete | — | build pass | VERIFIED | VERIFIED | FIXED |
| 22 | №18 | `/channel/*` | Delete post | P1 | FIXED | no DELETE route or owner UI for channel posts | `ChannelPostService::delete`, `DeleteChannelPostController` | `channel.$id` PostItem, `channels.ts` | — | ChannelPostDeleteTest | VERIFIED | VERIFIED | FIXED |
| 23 | №20 | `/channel/*`, feed | Media carousel | P1 | FIXED | video+photos stacked separately; PostCard ignored images when video set | — | `PostMediaCarousel`, `PostCard`, `channel.$id`, `feed.ts` | — | build pass | VERIFIED | VERIFIED | FIXED |
| 24 | №30 | `/channels` | Show all | P2 | code review | expanded list still 2-col grid | — | `channels.index.tsx` single column when expanded | — | build pass | VERIFIED | VERIFIED | FIXED |

---

## Этап D — Обзоры (public)

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 25 | №22 | `/reviews`, `/reviews/$id` | Review detail | **P0** | prod + code | uploader not registered in FE; sparse API uploader; unsafe views/author Link | `VideoResource`, `VideoService` | `reviews.ts`, `reviews.$id.tsx` | — | VideoUploadModerationTest | VERIFIED | VERIFIED | FIXED |
| 26 | №25 (player) | `/reviews/$id` | Video player | P1 | FIXED | empty URL/errors ignored; hardcoded mp4; duration/category/tags hidden; no Range on proxy | `VideoResource`, `ServeMediaController`, `VideoService` | `reviews.$id.tsx`, `reviews.ts` | — | VideoUploadModerationTest, ServeMediaRangeTest | VERIFIED | VERIFIED | FIXED |
| 27 | №25 (actions) | `/reviews/$id` | Engagement | P1 | FIXED | like/share already wired; no separate favorite API in spec | Video react API | `reviews.$id.tsx`, `VideoActionsMenu` | — | build pass | VERIFIED | VERIFIED | FIXED |
| 28 | №25 (comments) | `/reviews/$id` | Comments | P1 | FIXED | comments module present with preview + expand + create | Video comments API | `reviews.$id.tsx`, `CommentSection` | — | build pass | VERIFIED | VERIFIED | FIXED |
| 29 | №25 (similar) | `/reviews/$id` | Discovery | P2 | yes | author + similar blocks missing | VideoResource | `reviews.$id.tsx` related carousel + author | — | build pass | VERIFIED | VERIFIED | FIXED |
| 30 | №26 | `/reviews` | Category filter | P2 | yes | title stayed «Все обзоры» on category select | — | `reviews.index.tsx` dynamic sectionTitle | — | build pass | VERIFIED | VERIFIED | FIXED |

---

## Этап E — Обзоры (admin + categories)

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 31 | №23 | `/admin` reviews | Admin preview | P1 | yes | no preview modal/player | `AdminVideoController` | `admin.tsx` ReviewsSection preview modal | — | `AdminVideoTest` | VERIFIED | VERIFIED | FIXED |
| 32 | №23 | `/admin` | Admin actions | P1 | yes | limited approve/delete/featured only | Admin video API | admin reviews table actions | — | `AdminVideoTest` | VERIFIED | VERIFIED | FIXED |
| 33 | №23 | `/admin` | Admin metadata | P2 | code review | table lacked duration/engagement/date columns | VideoResource | admin reviews table + `AdminVideoRow` | — | build pass | VERIFIED | VERIFIED | FIXED |
| 34 | №23 | `/admin` | Filters/search | P2 | code review | search was client-only; API q unused on typing | Admin index API | ReviewsSection server q on Enter/refresh | — | build pass | VERIFIED | VERIFIED | FIXED |
| 35 | №23 | `/admin` | Bulk actions | P2 | code review | no bulk select on reviews table | — | ReviewsSection checkboxes + bulk bar | — | build pass | VERIFIED | VERIFIED | FIXED |
| 36 | №23 | `/admin` | Stats | P3 | code review | analytics showed only mock charts | fetchDashboard | AnalyticsSection KPI row + chart placeholders | — | build pass | VERIFIED | VERIFIED | FIXED |
| 37 | №23 | `/admin` | Audit/errors | P2 | code review | no media check in preview | — | preview modal media status + stats | — | build pass | VERIFIED | VERIFIED | FIXED |
| 38 | №23 | `/admin` | Media mgmt | P2 | code review | no hide/replace actions | status API | preview hide + replace link | — | build pass | VERIFIED | VERIFIED | FIXED |
| 39 | №24 | `/admin` | Review categories CRUD | P1 | yes | categories hardcoded / no admin CRUD | `AdminVideoCategoryController` | admin Categories «Обзоры» | — | `AdminVideoCategoryTest` | VERIFIED | VERIFIED | FIXED |
| 40 | №24 | `/admin`, upload | Category selector | P1 | yes | selector not from DB / no ordering | video categories API | `reviews.upload`, `reviews.index` sortOrder | — | `AdminVideoCategoryTest` | VERIFIED | VERIFIED | FIXED |
| 41 | №27 | `/reviews/upload`, `/admin` | Scheduled review | P1 | yes | feed scheduling only | `ScheduleVideoController`, cron | upload `PostSchedulePicker`, admin list | `scheduled_at` migration | `ScheduledVideoTest` | VERIFIED | VERIFIED | FIXED |

---

## Этап F — Локализация

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 42 | №34 | site-wide | i18n | P1 | done | — | P11: embedded admin components (banners, landing, icons, media, footer, guest access); P10/P9 admin.tsx | — | build pass | VERIFIED | VERIFIED | FIXED |

---

## Этап G — Regression

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 43 | №1–34 all | all | QA closure | **P0** | prod 2026-08-03 | Playwright P2 + SSR + API smoke; 66 OK / 0 FAIL | — | — | — | browser-qa.mjs | VERIFIED | VERIFIED | VERIFIED |

---

## Приоритеты (из PDF + этапов)

| Уровень | Task IDs |
|---------|----------|
| **P0** | 5, 6, 10, 19, 25, 43 |
| **P1** | 1, 7, 8, 9, 11, 12, 13, 22, 25–28, 31, 32, 39, 40, 41, 42 |
| **P2** | 2–4, 14–18, 20, 21, 23, 24, 29, 30, 33–35, 37, 38 |
| **P3** | 36 |

## План итераций (следующие шаги)

1. **Task 1** — инвентаризация `ImageUploadGrid` + 3 consumer paths; воспроизведение на 375px.
2. **Task 5, 6, 10, 19, 25** — P0 backend-first.
3. **Task 43** — VERIFIED 2026-08-01 (`run-qa-regression.sh`, report in `deploy/qa-artifacts/`).
4. **Task 11** — согласовать с PDF: вернуть fixed height + line-clamp (регрессия от commit `6b84d85`).
5. После каждого fix — обновлять колонки Status, Root cause, Tests, evidence в `docs/qa/evidence/`.

## Evidence

Скриншоты: `docs/qa/evidence/` (создавать по мере VERIFIED).

### Prod verification 2026-08-03 — **closing snapshot** (`run-qa-regression.sh`)

| Check | Result |
|-------|--------|
| VPS commit | `202d806` |
| Command | `bash deploy/scripts/run-qa-regression.sh` |
| SSR smoke | **22/22 OK** |
| API smoke | **SMOKE DONE** |
| Playwright | **67 OK, 0 WARN, 0 FAIL** |
| PHPUnit (full) | **189/189 OK** (879 assertions) |
| Artifacts | `deploy/qa-artifacts/2026-08-03/` — 47 PNG + `report.json` |
| Communities counters | sync-counters applied; Playwright: no zero members |

### Prod verification 2026-08-03 (P2 evidence)

| Check | Result |
|-------|--------|
| VPS commit | `d524e04` |
| Playwright P2 capture | **66 OK, 1 WARN, 0 FAIL** |
| Viewports | 375px + 1280px × 14 routes + channel/ads detail |
| Artifacts | `deploy/qa-artifacts/2026-08-03/` (`p2-*.png`, `task-*.png`, `report.json`) |
| Matrix Mobile/Desktop | **VERIFIED** (Tasks 1–5, 7–9, 11–42; 6/10 BE-only) |

### Prod verification 2026-08-03 (PHPUnit + backlog)

| Check | Result |
|-------|--------|
| VPS commit | `1ee826d` |
| Full PHPUnit | **187/187 OK** |
| Playwright | **34 OK, 0 WARN, 0 FAIL** (2026-08-03, commit `2947495`) |
| Backlog doc | [`backlog-prioritized.md`](./backlog-prioritized.md) |
| Evidence (auto) | `deploy/qa-artifacts/YYYY-MM-DD/*.png`, `report.json` on VPS |

### Prod verification 2026-08-03 (Task 42 closure + Task 43 re-run)

| Check | Result |
|-------|--------|
| VPS commit | `3bbd089` (Task 42 — Users/Ads/Design System i18n) |
| `modelizmclub-frontend.service` | active (deploy-frontend.sh) |
| `npm run build` (local) | pass |
| Playwright `browser-qa.mjs` on VPS | **32 OK, 2 WARN, 0 FAIL** — report `deploy/qa-artifacts/2026-08-02/report.json` |
| Playwright warnings | `/communities` «0 участников» (2 cards); 1 console.error (global) |

### Prod verification 2026-08-02

| Check | Result |
|-------|--------|
| VPS commit | `27604db` (matches `origin/master`) |
| `modelizmclub-frontend.service` | active |
| `https://modelizmclub.ru/` | HTTP 200 |
| `https://api.modelizmclub.ru/api/v1/health` | HTTP 200 |
| `smoke-frontend-routes.sh` | **22/22 OK** |
| `smoke-prod-release.sh` | **SMOKE DONE** (auth, feed moderation, billing URL, delivery) |
| QA PHPUnit filter (20 tests) | **20/20 OK** — AdminVideo, AdminVideoCategory, ScheduledVideo, ServeMediaRange, ChannelPostDelete, NotificationDelete, FeatureFlags, VideoUploadModeration |
| Full PHPUnit (187 tests) | 179 pass, **8 fail** — pre-existing (AuthFlow, ChatFrontendIntegration×2, Community×2, ChannelPostMedia, OAuthVerification, SellerCabinet); **not in QA matrix scope** |
| Playwright `browser-qa.mjs` on VPS | skipped — `npx playwright install` not run on server |

**Task 42 (i18n):** `FIXED` — admin.tsx + embedded components (P9–P11).

**Закрывающий snapshot:** `run-qa-regression.sh` — SSR 22/22, API SMOKE DONE, Playwright **67/0/0**, PHPUnit **189/189** (commit `202d806`).

Финальные артефакты (после Task 43):

- `docs/qa/modelizm-final-report.md`
- `docs/qa/modelizm-test-matrix.md` (snapshot PDF tests 1–34)

---

*Матрица создана 2026-08-01. Все пункты в статусе TODO до воспроизведения на prod/staging.*
