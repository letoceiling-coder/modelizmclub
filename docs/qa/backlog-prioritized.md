# Modelizm QA — приоритизированный backlog (post-43)

Обновлено: 2026-08-03. Матрица 43/43 **FIXED**; backlog P0–P3 **закрыт**.

## P0 — стабильность CI / prod

| # | Задача | Статус | Файлы / команда |
|---|--------|--------|-----------------|
| 1 | **8 PHPUnit → 0 fail** | **DONE** (187/187) | commit `4e86e1b` |
| 2 | **Playwright WARN → 0** | **DONE** | **34 OK, 0 WARN, 0 FAIL** (2026-08-03) |
| 3 | Re-run prod regression | **DONE** | PHPUnit 187/187 + Playwright on VPS |

## P1 — i18n admin (Task 42 completion)

| # | Секция admin.tsx | Статус |
|---|------------------|--------|
| 1 | `DeliverySection` | **DONE** |
| 2 | `ModerationSection` + `ReportsSection` + `ModerationCard` | **DONE** |
| 3 | `SettingsSection` — `SETTING_META`, feature cards | **DONE** |
| 4 | `FeedbackSection` | **DONE** |
| 5 | `MonetizationSection`, `FeedBannersSection`, `ApplicationsSection` | **DONE** |
| 6 | `CategoriesSection`, `NotificationsSection`, `AuditLogSection` | **DONE** |

**Сделано:** все секции `admin.tsx` переведены (P9–P10); embedded-компоненты (P11) — **DONE**.

| # | Компонент | Статус |
|---|-----------|--------|
| 1 | `BannersAdminCard` | **DONE** |
| 2 | `LandingBlocksAdminCard` + `LandingCardIconField` | **DONE** |
| 3 | `FeedGuestAccessAdminCard` | **DONE** |
| 4 | `FooterContactsAdminCard` | **DONE** |
| 5 | `MediaManagerCard` (+ picker) | **DONE** |
| 6 | `IconManagerSection` + `IconSlotPreview` | **DONE** |

**Паттерн:** `pages.adminX.*` в `ru.ts` → `patch-en-pN.ts` → `sync-i18n.ts`. Последний: **P11** (`patch-en-p11.ts`).

**Task 42 (i18n admin):** полностью закрыт — следующий приоритет **P2** mobile/desktop evidence.

## P2 — Mobile / Desktop evidence (матрица колонки)

**Статус: DONE** (2026-08-03, commit `d524e04`).

Playwright `browser-qa.mjs` — **66 OK, 1 WARN, 0 FAIL**; P2 capture: 14 auth-маршрутов × 375px + 1280px + channel/ads detail.

| Артефакты | Путь |
|-----------|------|
| Report | `deploy/qa-artifacts/2026-08-03/report.json` |
| Route shots | `p2-{slug}-{mobile\|desktop}.png` (feed, profile, messenger, …) |
| Task aliases | `task-{ID}-{mobile\|desktop}.png` (4, 8, 13, 16, 19, 25, 42) |
| P0 legacy | `review-detail-*.png`, `ads-new-mobile.png`, `admin.png` |

Матрица `modelizm-43-fixes.md`: колонки Mobile/Desktop → **VERIFIED** (кроме BE-only: Task 6, 10).

**Ручной 100% проход** больше не требуется для закрытия backlog; опционально — spot-check по PDF.

## P3 — прочее

**Статус: DONE** (2026-08-03).

| # | Задача | Статус | Детали |
|---|--------|--------|--------|
| 1 | Sync `members_count` / `posts_count` | **DONE** | `php artisan communities:sync-counters` (+ daily schedule) |
| 2 | `modelizm-final-report.md` | **DONE** | Snapshot 2026-08-03 |
| 3 | PHPUnit full CI | **DONE** | 187/187 (2026-08-03) |

```bash
# Prod one-off / verify drift
ssh root@31.207.75.124 "cd /var/www/modelizmclub/backend && php artisan communities:sync-counters --dry-run"
ssh root@31.207.75.124 "cd /var/www/modelizmclub/backend && php artisan communities:sync-counters"
```

## Команды

```bash
# PHPUnit (VPS)
bash /var/www/modelizmclub/deploy/scripts/run-server-tests.sh

# Playwright
cd /var/www/modelizmclub/deploy && npm run qa

# Frontend deploy
bash /var/www/modelizmclub/deploy/scripts/deploy-frontend.sh
```
