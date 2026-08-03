# QA evidence

## Автоматические артефакты (prod VPS)

**Последний прогон:** 2026-08-03 — commit `202d806`, **67 OK / 0 WARN / 0 FAIL**

- Путь: `/var/www/modelizmclub/deploy/qa-artifacts/2026-08-03/`
- Report: `report.json`
- P2 route shots: `p2-{slug}-mobile.png`, `p2-{slug}-desktop.png`
- Task aliases: `task-4-mobile.png`, `task-8-mobile.png`, `task-13-desktop.png`, `task-16-mobile.png`, `task-19-mobile.png`, `task-25-mobile.png`, `task-25-desktop.png`, `task-42-desktop.png`
- P0 legacy: `review-detail-mobile.png`, `ads-new-mobile.png`, `admin.png`, `after-login.png`

### P2 slugs (375px + 1280px each)

`feed`, `profile`, `messenger`, `notifications`, `channels`, `ads`, `ads-new`, `reviews`, `reviews-upload`, `admin`, `settings`, `my-ads`, `favorites`, `friends`, `channel-detail`, `ads-detail`

## Матрица

Колонки Mobile/Desktop в [`modelizm-43-fixes.md`](../modelizm-43-fixes.md) — **VERIFIED** для всех UI-задач (Task 6, 10 — backend-only, «—»).

## Команда

```bash
ssh root@31.207.75.124 "cd /var/www/modelizmclub/deploy && npm run qa"
```
