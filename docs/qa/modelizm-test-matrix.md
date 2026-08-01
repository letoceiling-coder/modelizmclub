# Modelizm Club — матрица PDF-тестов (№1–34)

Источник: [`modelizm-test.pdf`](./modelizm-test.pdf)  
Атомарные задачи: [`modelizm-43-fixes.md`](./modelizm-43-fixes.md)  
Снимок: **2026-08-01** (после Task 43 regression)

| PDF № | Область | Маршрут / экран | Task ID | P | Статус | Примечание |
|------|---------|-----------------|---------|---|--------|------------|
| 1 | Media upload | `/feed`, `/ads/new`, каналы | 1 | P1 | FIXED | 5-col grid, overlay buttons |
| 2 | Post draft | `/feed` | 2 | P2 | FIXED | Компактный баннер черновика |
| 3 | Post title | `/feed` | 3 | P2 | FIXED | Лимит 200 + счётчик |
| 4 | Feed filters | `/feed` | 4 | P2 | FIXED | Mobile grid chips |
| 5 | Moderation | `/feed` | 5 | **P0** | **FIXED** | Bookmark/repost guard + FE disabled |
| 6 | Calls | `/messenger` | 13 | P1 | TODO | Toast vs Accept/Decline |
| 7 | Chat delivery | `/messenger` | 6 | **P0** | **FIXED** | WS ingest + fetchConversation |
| 8 | Notifications layout | `/notifications` | 16 | P2 | TODO | Header overflow 320px |
| 9 | Notifications persist | `/notifications` | 7 | P1 | TODO | Undo toast only |
| 10 | Profile edit | `/profile` | 8 | P1 | TODO | Overlay без dialog |
| 11 | Profile tabs | `/profile` | 17 | P2 | TODO | Cramped mobile tabs |
| 12 | Profile ad cards | `/profile` | 18 | P2 | TODO | Date wrap |
| 13 | Presence | `/messenger` | 14 | P2 | TODO | Status wrap in header |
| 14 | Media bubbles | `/messenger` | 15 | P2 | TODO | Large voice/image bubbles |
| 15 | Media upload | см. №1 | 1 | P1 | FIXED | — |
| 16 | Ads CTA | `/ads/new` preview | 19 | **P0** | **FIXED** | Text-only CTA, mobile stack |
| 17 | Channel owner UI | `/channels` | 21 | P2 | TODO | Inline owner actions |
| 18 | Channel delete post | `/channel/*` | 22 | P1 | TODO | No delete for owner |
| 19 | Media upload | см. №1 | 1 | P1 | FIXED | — |
| 20 | Channel media carousel | `/channel/*` | 23 | P1 | TODO | Stacked vs carousel |
| 21 | Admin settings | `/admin`, nav | 9 | P1 | TODO | Feature flags partial |
| 22 | Review detail crash | `/reviews/$id` | 25 | **P0** | **FIXED** | Uploader API + FE guards |
| 23 | Admin reviews | `/admin` | 31–38, 40 | P1–P3 | TODO | Preview, CRUD, bulk |
| 24 | Review categories | `/admin`, upload | 39–40 | P1 | TODO | DB categories |
| 25 | Review page UX | `/reviews/$id` | 26–29 | P1–P2 | TODO | Player, likes, comments UI |
| 26 | Reviews filter title | `/reviews` | 30 | P2 | TODO | «Все обзоры» vs category |
| 27 | Scheduled reviews | upload, admin | 41 | P1 | TODO | Feed scheduling only |
| 28 | Feed banner | `/feed`, admin | 11 | P1 | TODO | Fixed height regression |
| 29 | Feed comments | `/feed` | 12 | P1 | TODO | Inline comments |
| 30 | Channels show all | `/channels` | 24 | P2 | TODO | Vertical expand |
| 31 | Ads CTA | см. №16 | 19 | **P0** | **FIXED** | — |
| 32 | Listing re-moderation | `/ads/*` edit | 10 | **P0** | **FIXED** | pending_moderation on edit |
| 33 | Ad owner panel | `/ads/$id` | 20 | P2 | TODO | Stats layout |
| 34 | Full regression | all | 43 | **P0** | **VERIFIED** | Playwright + smoke 2026-08-01 |

## P0 closure (2026-08-01)

| Task | PDF | Result |
|------|-----|--------|
| 5 | №5 | FIXED + backend tests on VPS |
| 6 | №7 | FIXED + ChatFrontendIntegrationTest |
| 10 | №32 | FIXED + ListingCreateValidationTest |
| 19 | №16, №31 | FIXED + mobile QA pass |
| 25 | №22 | FIXED + VideoUploadModerationTest + Playwright |
| 43 | №1–34 | VERIFIED — `deploy/qa-artifacts/2026-08-01/report.json` |
