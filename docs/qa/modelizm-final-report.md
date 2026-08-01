# Modelizm Club — финальный QA-отчёт (Task 43)

**Дата:** 2026-08-01  
**Prod:** https://modelizmclub.ru · API https://api.modelizmclub.ru  
**HEAD:** `7c09733` (Task 25) + Task 43 harness  
**Источник требований:** [`modelizm-test.pdf`](./modelizm-test.pdf)

---

## Резюме

Все **P0-дефекты из PDF** (Tasks 5, 6, 10, 19, 25) исправлены и проверены на production.  
Task 43 — финальная регрессия: SSR smoke, API smoke, Playwright browser QA.

| Уровень | Всего в матрице | FIXED | VERIFIED | TODO |
|---------|-----------------|-------|----------|------|
| **P0** | 6 | 5 | 1 (Task 43) | 0 |
| P1 | 16 | 1 | — | 15 |
| P2 | 20 | 4 | — | 16 |
| P3 | 1 | 0 | — | 1 |

---

## P0 — что сделано

### Task 5 — модерация ленты (PDF №5)
- Backend: `PostInteractionRules`, guard bookmark/repost для moderated posts
- Frontend: disabled interactions на moderated posts
- Tests: `PostModerationInteractionsTest` (VPS)

### Task 6 — доставка чата (PDF №7)
- Frontend: `ingestIncomingMessage` → `fetchConversation` + pending queue
- Tests: `ChatFrontendIntegrationTest`

### Task 10 — re-moderation объявлений (PDF №32)
- Backend: `ListingService::update()` → `pending_moderation` when autopublish off
- Frontend: toast `sentModeration` on edit
- Tests: `ListingCreateValidationTest` (6/6 VPS)

### Task 19 — CTA превью объявления (PDF №16, №31)
- Frontend: text-only publish CTA, full-width mobile footer
- QA: `/ads/new` opens on 375px after admin login (Playwright)

### Task 25 — страница обзора (PDF №22)
- Backend: `VideoResource` uploader via `UserCompactResource`
- Frontend: `registerAuthor` in `mapVideo`, safe views/author link
- Tests: `VideoUploadModerationTest` (4/4 VPS)
- QA: list → detail desktop + 375px, no error boundary

---

## Task 43 — прогон регрессии (2026-08-01)

### 1. Frontend SSR (`smoke-frontend-routes.sh`)
- **21/21 OK** (после fix: `curl -L` для internal 307 на `/messenger`)

### 2. API smoke (`smoke-prod-release.sh`)
- Health, auth, feed moderation toggle, billing checkout URL, login SSR — **PASS**

### 3. Playwright (`deploy/scripts/browser-qa.mjs`)
- **33 OK, 1 WARN, 0 FAIL**
- Report: `deploy/qa-artifacts/2026-08-01/report.json`
- Screenshots: `review-detail-desktop.png`, `review-detail-mobile.png`, `ads-new-mobile.png`

**P0 checks:**
| Check | Result |
|-------|--------|
| P0-25 reviews list | 5 cards |
| P0-25 review detail desktop | «Визитная карточка», no boundary |
| P0-25 review detail mobile 375px | OK |
| P0-19 /ads/new mobile | OK |
| Admin auth routes | All HTTP 200 |

**WARN:** 2× console 401 on `/me/view-history` for guest — expected, non-blocking.

---

## Оставшийся backlog (не P0)

Приоритетные P1 для следующих итераций:
- Task 7, 8, 9 — notifications, profile
- Task 11 — feed banner fixed height (регрессия от `6b84d85`)
- Task 12 — inline feed comments
- Tasks 22–23 — channel delete, media carousel
- Tasks 26–28 — review player, engagement, comments UX
- Tasks 31–41 — admin reviews, categories, scheduling

Полная карта: [`modelizm-test-matrix.md`](./modelizm-test-matrix.md), [`modelizm-43-fixes.md`](./modelizm-43-fixes.md).

---

## Как повторить регрессию

```bash
# На VPS или локально (нужен Node + bash)
bash deploy/scripts/run-qa-regression.sh

# Только browser QA
cd deploy && npm install && npx playwright install chromium && npm run qa
```

Переменные: `QA_BASE`, `QA_EMAIL`, `QA_PASSWORD`.

---

## Evidence

| Артефакт | Путь |
|----------|------|
| Playwright JSON | `deploy/qa-artifacts/2026-08-01/report.json` |
| Screenshots | `deploy/qa-artifacts/2026-08-01/*.png` |
| Матрица задач | `docs/qa/modelizm-43-fixes.md` |
| PDF mapping | `docs/qa/modelizm-test-matrix.md` |
