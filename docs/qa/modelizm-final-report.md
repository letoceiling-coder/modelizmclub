# Modelizm Club — финальный QA-отчёт (Task 43 closure)

**Дата:** 2026-08-03  
**Prod:** https://modelizmclub.ru · API https://api.modelizmclub.ru  
**HEAD:** `202d806` (closing regression snapshot)  
**Источник требований:** [`modelizm-test.pdf`](./modelizm-test.pdf)

---

## Резюме

Матрица **43/43 FIXED**; backlog **P0–P3 закрыт**. Закрывающий прогон `run-qa-regression.sh` на prod — **2026-08-03**.

| Уровень | В матрице | FIXED | VERIFIED (Mobile/Desktop) |
|---------|-----------|-------|---------------------------|
| **P0** | 6 | 6 | 6 |
| P1 | 16 | 16 | 16 |
| P2 | 20 | 20 | 20 |
| P3 | 1 | 1 | 1 |

| Check | Result |
|-------|--------|
| SSR smoke | **22/22 OK** |
| API smoke | **SMOKE DONE** |
| Playwright | **67 OK, 0 WARN, 0 FAIL** |
| PHPUnit | **189/189 OK** (879 assertions) |
| Artifacts | `deploy/qa-artifacts/2026-08-03/` — 47 PNG + `report.json` |

---

## P0 — закрытые дефекты

| Task | PDF | Суть | Проверка |
|------|-----|------|----------|
| 5 | №5 | Модерация ленты — bookmark/repost guard | PHPUnit + Playwright `/feed` |
| 6 | №7 | WS chat delivery — ingestIncomingMessage | BE/FE fix, shell OK |
| 10 | №32 | Re-moderation объявлений на edit | Feature tests |
| 19 | №16,31 | CTA `/ads/new` на 375px | `task-19-mobile.png` |
| 25 | №22 | Review detail uploader/views | `task-25-mobile/desktop.png` |
| 43 | №1–34 | Regression harness | 67 OK, 0 FAIL |

---

## P1 — i18n admin (Task 42)

Полный перевод админки: `admin.tsx` (P9–P10) + embedded-компоненты (P11):

- Banners, Landing blocks, Feed guest access, Footer contacts, Media manager, Icon manager
- `patch-en-p9` … `patch-en-p11`, `sync-i18n.ts`

---

## P2 — Mobile / Desktop evidence

Автоматический capture в `browser-qa.mjs` (commit `d524e04`):

- 14 auth-маршрутов × 375px + 1280px
- Dynamic: `/channel/modelizm`, `/ads/{uuid}`
- Task aliases: 4, 8, 13, 16, 19, 25, 42

Артефакты: `deploy/qa-artifacts/2026-08-03/` на VPS.

Колонки Mobile/Desktop матрицы → **VERIFIED** (Tasks 6, 10 — backend-only «—»).

---

## P3 — maintenance

| Item | Статус |
|------|--------|
| `communities:sync-counters` artisan | **DONE** — prod 2026-08-03: 1 community fixed (`modelizmclub`: members 0→2, posts 10→0); daily schedule |
| PHPUnit full CI | **189/189** |
| Final report | This document (2026-08-03) |

---

## Task 43 — закрывающий прогон (2026-08-03)

Команда: `bash deploy/scripts/run-qa-regression.sh` на VPS (`202d806`).

### 1. Frontend SSR (`smoke-frontend-routes.sh`)

**22/22 OK** — landing, ads, feed, reviews, channels, communities, messenger, auth shell, settings.

### 2. API smoke (`smoke-prod-release.sh`)

**SMOKE DONE** — health, auth, feed moderation toggle, YooKassa checkout URL, delivery keys, login SSR.

### 3. Playwright (`browser-qa.mjs`)

| Metric | Result |
|--------|--------|
| OK / WARN / FAIL | **67 / 0 / 0** |
| Report | `deploy/qa-artifacts/2026-08-03/report.json` |
| Screenshots | 47 PNG (P2 routes + task aliases + P0 legacy) |
| Communities | «Нет нулевых счётчиков» |
| Console | 0 errors |

**P0 checks:** reviews list/detail desktop+mobile, `/ads/new` mobile, admin auth routes — all OK.

### 4. PHPUnit (full suite, post-regression)

```bash
cd backend && php artisan test
# 189 passed (879 assertions)
```

---

## Как повторить регрессию

```bash
# Full regression (SSR + API + Playwright)
bash deploy/scripts/run-qa-regression.sh

# Sync community counters (prod maintenance)
cd backend && php artisan communities:sync-counters
# dry-run: php artisan communities:sync-counters --dry-run

# Browser QA only
cd deploy && npm run qa
```

Переменные Playwright: `QA_BASE`, `QA_EMAIL`, `QA_PASSWORD`.

---

## Evidence index

| Артефакт | Путь |
|----------|------|
| Playwright JSON | `deploy/qa-artifacts/2026-08-03/report.json` |
| P2 screenshots | `deploy/qa-artifacts/2026-08-03/p2-*.png` |
| Task aliases | `deploy/qa-artifacts/2026-08-03/task-*.png` |
| Evidence README | [`evidence/README.md`](./evidence/README.md) |
| Матрица 43 задач | [`modelizm-43-fixes.md`](./modelizm-43-fixes.md) |
| PDF mapping | [`modelizm-test-matrix.md`](./modelizm-test-matrix.md) |
| Backlog | [`backlog-prioritized.md`](./backlog-prioritized.md) |

---

*Snapshot обновлён 2026-08-03 после закрытия P0–P2 backlog.*
