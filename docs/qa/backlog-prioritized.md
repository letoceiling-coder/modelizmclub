# Modelizm QA — приоритизированный backlog (post-43)

Обновлено: 2026-08-03. Матрица 43/43 **FIXED**; ниже — полировка и техдолг.

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
| 5 | `MonetizationSection`, `FeedBannersSection`, `ApplicationsSection` | pending |
| 6 | `CategoriesSection` (non-reviews), `NotificationsSection`, `AuditLogSection` | pending |

**Сделано:** shell, dashboard, users, ads, design system, reviews, content, analytics, delivery, moderation, feedback, settings (feature cards + meta).

**Паттерн:** `pages.adminX.*` в `ru.ts` → `patch-en-pN.ts` → `sync-i18n.ts`. Последний: **P9** (`patch-en-p9.ts`).

## P2 — Mobile / Desktop evidence (матрица колонки)

Playwright Task 43 покрывает **375px + 1280px** для ключевых маршрутов (не все 43 пункта по отдельности).

| Покрыто Playwright | Mobile | Desktop |
|--------------------|--------|---------|
| Public routes (/, login, ads, feed, reviews, …) | partial | OK |
| P0-25 reviews detail | OK | OK |
| P0-19 ads/new | OK | — |
| Auth shell (feed, profile, messenger, admin, …) | — | OK |

**Ручной чеклист (если нужен 100% матрицы):**

1. Открыть `docs/qa/modelizm-43-fixes.md`, фильтр `pending` в колонках Mobile/Desktop.
2. На 375px и 1280px пройти маршрут из колонки «Маршрут».
3. Скриншот → `docs/qa/evidence/task-{ID}-{viewport}.png`.
4. Обновить колонку → `VERIFIED`.

**Авто-артефакты VPS:** `deploy/qa-artifacts/YYYY-MM-DD/*.png`, `report.json`.

## P3 — прочее

- Синхронизация `members_count` на prod (communities с 0 в счётчике).
- `modelizm-final-report.md` — финальный snapshot после P0 закрыт.
- 8 PHPUnit вне QA-фильтра — не блокируют PDF, но должны быть зелёными для полного CI.

## Команды

```bash
# PHPUnit (VPS)
bash /var/www/modelizmclub/deploy/scripts/run-server-tests.sh

# Playwright
cd /var/www/modelizmclub/deploy && npm run qa

# Frontend deploy
bash /var/www/modelizmclub/deploy/scripts/deploy-frontend.sh
```
