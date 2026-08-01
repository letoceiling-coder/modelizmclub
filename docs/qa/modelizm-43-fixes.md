# Modelizm Club — матрица 43 атомарных задач (PDF modelizm-test)

Источник: [`modelizm-test.pdf`](./modelizm-test.pdf)  
Baseline: [`modelizm-baseline.md`](./modelizm-baseline.md)  
Статусы: `TODO` | `REPRODUCED` | `IN_PROGRESS` | `FIXED` | `VERIFIED` | `BLOCKED`

---

## Этап A — Общие компоненты и критические дефекты

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 1 | №1, №15, №19 | `/feed`, `/ads/new`, `/channel/*` | Media upload | P1 | code review | Fixed 5-col grid + overlay buttons; no i18n | — | `ImageUploadGrid.tsx`, `CreatePostForm`, `channel.$id` | — | build pass | pending deploy | pending deploy | FIXED |
| 2 | №2 | `/feed` | Post draft | P2 | code review | Vertical banner + long copy took too much space | — | `CreatePostForm.tsx`, i18n | — | — | pending | pending | FIXED |
| 3 | №3 | `/feed` | Post title | P2 | code review | BE max:200, FE без лимита и счётчика | `PostFormRules`, Store/UpdatePostRequest | `CreatePostForm`, `post-limits.ts`, `PostCard` | — | unit test | pending | pending | FIXED |
| 4 | №4 | `/feed` | Feed filters | P2 | code review | grid 2×3 на mobile, высокие chips | — | `FeedFilterTabs.tsx` | — | — | pending | pending | FIXED |
| 5 | №5 | `/feed` | Moderation | **P0** | code review | bookmark без проверки status; FE не disabled | `PostInteractionRules`, services | `PostCard`, `PostActionMenu`, `RepostMenu` | — | unit + feature (VPS) | pending | pending | FIXED |
| 6 | №7 | `/messenger` | Chat delivery | **P0** | FIXED | WS message dropped when dialog missing from store | `ChatService`, WS | `store.ts` ingestIncomingMessage | — | — | — | — | FIXED |
| 7 | №9 | `/notifications` | Notifications | P1 | — | Partial work: undo toast; persist TBD | `NotificationController` | `notifications.tsx` | — | — | — | — | TODO |
| 8 | №10 | `/profile` | Profile edit | P1 | — | TBD: overlay без dialog content | Profile API | `profile.tsx` modal | — | — | — | — | TODO |
| 9 | №21 | `/admin`, nav | Settings | P1 | — | Partial: toggle exists; apply to nav TBD | `SystemSetting`, feature flags | `admin.tsx`, nav components | — | — | — | — | TODO |
| 10 | №32 | `/ads/*` | Listing moderation | **P0** | FIXED | update() skipped re-moderation gate | `ListingService::update()` | `ads.new.tsx` edit toast | — | feature tests | — | — | FIXED |

---

## Этап B — Feed, Messenger, Notifications, Profile, Ads UI

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 11 | №28 | `/feed`, `/admin` | Banner | P1 | FIXED | min-h regression from `6b84d85`; restored fixed h + line-clamp | Banner limits | `BannerHeroSlide`, `EventsHero`, admin preview | — | build pass | pending | pending | FIXED |
| 12 | №29 | `/feed` | Comments | P1 | — | TBD: нет inline comments в `PostCard` | `PostCommentsController` exists | `PostCard`, feed | — | — | — | — | TODO |
| 13 | №6 | `/messenger` | Calls | P1 | — | TBD: toast перекрывает Accept/Decline | — | call UI + toast z-index | — | — | — | — | TODO |
| 14 | №13 | `/messenger` | Presence | P2 | — | TBD: status wraps in chat header | — | `messenger.tsx` header | — | — | — | — | TODO |
| 15 | №14 | `/messenger` | Media bubbles | P2 | — | TBD: voice/image bubbles too large | — | `MessageFileBubble`, voice UI | — | — | — | — | TODO |
| 16 | №8 | `/notifications` | Layout | P2 | — | TBD: header overflow 320px | — | `notifications.tsx` header | — | — | — | — | TODO |
| 17 | №11 | `/profile` | Tabs | P2 | — | TBD: profile tabs cramped mobile | — | `profile.tsx` tabs | — | — | — | — | TODO |
| 18 | №12 | `/profile` | Ad cards | P2 | — | TBD: date wraps in profile ad card | — | profile listings tab | — | — | — | — | TODO |
| 19 | №16, №31 | `/ads/new` | CTA | **P0** | FIXED | Icon-only CTA + clipped label on mobile preview step | listing publish API | `ads.new.tsx` footer CTA | — | — | pending | pending | FIXED |
| 20 | №33 | `/ads/$id` (owner) | Owner panel | P2 | — | Partial: `AdOwnerActionPanel` exists; stats layout TBD | — | `AdOwnerActionPanel`, `ads.$id` | — | — | — | — | TODO |

---

## Этап C — Каналы

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 21 | №17 | `/channels` | Channel owner UI | P2 | — | TBD: owner actions inline, not in ⋮ menu | permissions | channels list card | — | — | — | — | TODO |
| 22 | №18 | `/channel/*` | Delete post | P1 | — | TBD: no delete for channel owner | Channel post policy | `channel.$id`, post menu | — | — | — | — | TODO |
| 23 | №20 | `/channel/*`, feed | Media carousel | P1 | — | TBD: video+photos stacked, not carousel | — | `PostCard` / channel post view | — | — | — | — | TODO |
| 24 | №30 | `/channels` | Show all | P2 | — | TBD: «Показать все» expands vertical list | — | channels popular block | — | — | — | — | TODO |

---

## Этап D — Обзоры (public)

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 25 | №22 | `/reviews`, `/reviews/$id` | Review detail | **P0** | prod + code | uploader not registered in FE; sparse API uploader; unsafe views/author Link | `VideoResource`, `VideoService` | `reviews.ts`, `reviews.$id.tsx` | — | VideoUploadModerationTest | pending | pending | FIXED |
| 26 | №25 (player) | `/reviews/$id` | Video player | P1 | — | TBD: player/metadata incomplete | Video module | review detail | — | — | — | — | TODO |
| 27 | №25 (actions) | `/reviews/$id` | Engagement | P1 | — | TBD: like/favorite/share missing or broken | Video API | review detail | — | — | — | — | TODO |
| 28 | №25 (comments) | `/reviews/$id` | Comments | P1 | — | TBD: comments module incomplete | Video comments | review detail | — | — | — | — | TODO |
| 29 | №25 (similar) | `/reviews/$id` | Discovery | P2 | — | TBD: author + similar blocks | — | review detail | — | — | — | — | TODO |
| 30 | №26 | `/reviews` | Category filter | P2 | — | TBD: title stays «Все обзоры» | — | `reviews.index.tsx` | — | — | — | — | TODO |

---

## Этап E — Обзоры (admin + categories)

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 31 | №23 | `/admin` reviews | Admin preview | P1 | — | TBD: no preview action | Admin video controllers | `admin.tsx` reviews section | — | — | — | — | TODO |
| 32 | №23 | `/admin` | Admin actions | P1 | — | TBD: limited action menu | Admin API | admin reviews UI | — | — | — | — | TODO |
| 33 | №23 | `/admin` | Admin metadata | P2 | — | TBD: table lacks metadata columns | Admin resources | admin reviews table | — | — | — | — | TODO |
| 34 | №23 | `/admin` | Filters/search | P2 | — | TBD: no server-side filters | Admin index API | admin reviews | — | — | — | — | TODO |
| 35 | №23 | `/admin` | Bulk actions | P2 | — | TBD: no bulk select (cf. listings bulk done) | bulk endpoints | admin reviews | — | — | — | — | TODO |
| 36 | №23 | `/admin` | Stats | P3 | — | TBD: stats not shown / mock | analytics events | admin drawer | — | — | — | — | TODO |
| 37 | №23 | `/admin` | Audit/errors | P2 | — | TBD: no change log / media check UI | AuditService | admin review detail | — | — | — | — | TODO |
| 38 | №23 | `/admin` | Media mgmt | P2 | — | TBD: replace video/cover, hide | Media API | admin actions | — | — | — | — | TODO |
| 39 | №24 | `/admin` | Review categories CRUD | P1 | — | TBD: categories hardcoded / no admin CRUD | Video categories | admin section | migration? | — | — | — | TODO |
| 40 | №24 | `/admin`, upload | Category selector | P1 | — | TBD: selector not from DB / no ordering | Catalog API | `reviews.upload`, admin | — | — | — | — | TODO |
| 41 | №27 | `/reviews/upload`, `/admin` | Scheduled review | P1 | — | Feed scheduling done; **reviews not** | Video schedule + cron | upload form, admin list | migration? | — | — | — | TODO |

---

## Этап F — Локализация

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 42 | №34 | site-wide | i18n | P1 | — | TBD: hardcoded RU strings, mixed languages | API error i18n | `ru/en/zh.ts`, components | — | — | — | — | TODO |

---

## Этап G — Regression

| ID | Тест PDF | Маршрут | Модуль | P | Воспроизведено | Root cause | Backend | Frontend | DB | Tests | Mobile | Desktop | Status |
|----|----------|---------|--------|---|----------------|------------|---------|----------|-----|-------|--------|---------|--------|
| 43 | №1–34 all | all | QA closure | **P0** | prod 2026-08-01 | Playwright + SSR + API smoke; 33 OK / 0 FAIL | — | — | — | browser-qa.mjs | 375px + 1280px | 1280px | VERIFIED |

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

Финальные артефакты (после Task 43):

- `docs/qa/modelizm-final-report.md`
- `docs/qa/modelizm-test-matrix.md` (snapshot PDF tests 1–34)

---

*Матрица создана 2026-08-01. Все пункты в статусе TODO до воспроизведения на prod/staging.*
