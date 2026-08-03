# Modelizm Club — финальный QA-отчёт (Task 43 closure)

**Дата:** 2026-08-03  
**Prod:** https://modelizmclub.ru · API https://api.modelizmclub.ru  
**HEAD:** `55a6319` (P2 evidence docs) · backend P3 counters pending deploy  
**Источник требований:** [`modelizm-test.pdf`](./modelizm-test.pdf)

---

## Резюме

Матрица **43/43 FIXED**; P0–P2 backlog **закрыт**. Все P0-дефекты из PDF исправлены и проверены на production.

| Уровень | В матрице | FIXED | VERIFIED (Mobile/Desktop) |
|---------|-----------|-------|---------------------------|
| **P0** | 6 | 6 | 6 |
| P1 | 16 | 16 | 16 |
| P2 | 20 | 20 | 20 |
| P3 | 1 | 1 | 1 |

**PHPUnit:** 187/187 OK (2026-08-03, `4e86e1b`)  
**Playwright:** 66 OK, 1 WARN, 0 FAIL (2026-08-03, `d524e04`) — P2 evidence 375px + 1280px

---

## P0 — закрытые дефекты

| Task | PDF | Суть | Проверка |
|------|-----|------|----------|
| 5 | №5 | Модерация ленты — bookmark/repost guard | PHPUnit + Playwright `/feed` |
| 6 | №7 | WS chat delivery — ingestIncomingMessage | BE/FE fix, shell OK |
| 10 | №32 | Re-moderation объявлений на edit | Feature tests |
| 19 | №16,31 | CTA `/ads/new` на 375px | `task-19-mobile.png` |
| 25 | №22 | Review detail uploader/views | `task-25-mobile/desktop.png` |
| 43 | №1–34 | Regression harness | 66 OK, 0 FAIL |

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
| `communities:sync-counters` artisan | Added — recompute `members_count` / `posts_count`; daily schedule |
| PHPUnit full CI | **187/187** |
| Final report | This document (2026-08-03) |

---

## Task 43 — последний прогон (2026-08-03)

### Playwright (`deploy/scripts/browser-qa.mjs`)

| Metric | Result |
|--------|--------|
| OK / WARN / FAIL | **66 / 1 / 0** |
| Report | `deploy/qa-artifacts/2026-08-03/report.json` |
| WARN | 2× HTTP 429 in console (rate limit, non-blocking) |
| Communities | «Нет нулевых счётчиков» |

**P0 checks:** reviews list/detail desktop+mobile, `/ads/new` mobile, admin auth routes — all OK.

### PHPUnit (VPS)

```bash
bash deploy/scripts/run-server-tests.sh
# 187 passed
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
