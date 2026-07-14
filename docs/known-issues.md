# Known issues — infrastructure / deploy scripts

Non-code problems found while working on the app, recorded here instead of
silently working around them each time, so they get fixed once at the
source.

## `deploy-neeklo-frontend.sh` does not `git pull`

**Found:** 2026-07-13, while deploying a hotfix for a production crash on `/feed`.

`deploy/scripts/deploy-neeklo-frontend.sh` builds and restarts the frontend
from whatever is *currently checked out* on the server — it never runs
`git pull`. Only `deploy/scripts/deploy-neeklo.sh` (the backend script) pulls.

Consequence: running the frontend-only deploy script after pushing new
frontend commits silently rebuilds the **old** code. The build succeeds,
the service restarts, everything reports "OK" — but the live site doesn't
change. This is easy to miss because there is no error; the deployed
JS chunk hashes just don't change.

**What happened concretely:** a hotfix commit was pushed, the frontend
deploy script was run, it reported success, but the site kept crashing
with the exact same error and the exact same JS chunk hash as before the
fix. Only checking `git log -1` on the server (and comparing asset
filenames) revealed the script had built stale code.

**Suggested fix:** add a `git pull origin <branch>` step to
`deploy-neeklo-frontend.sh` (mirroring what `deploy-neeklo.sh` already
does), or document clearly that the backend script must always run first
even for frontend-only changes.

**Workaround until fixed:** always run `git -C /var/www/modelizmclub-neeklo
pull origin neeklo` manually before invoking
`deploy-neeklo-frontend.sh`, and verify by diffing `git log -1` before/after
or checking that the built asset hash for a known-changed file actually
changed.

---

## Pre-deploy audit findings — 2026-07-14 (frontend)

Собрано в аудит-проходе перед финальным деплоем. Ничего из этого не блокирует
уже сделанные фиксы; это hygiene/follow-up + один реальный-режим блокер, зависящий
от бэкенда.

### Мёртвый код / clutter (не регрессия, pre-existing)
- **`frontend/src/components/AdBanner.tsx`** — компонент без единого импортёра
  (`grep` подтверждает 0 использований). Кандидат на удаление. Не влияет на
  сборку (tree-shaken), просто мёртвый файл.
- **Дубликаты `* 2.ts` / `* 2.tsx` в `frontend/src/`** — ~50 файлов-копий
  (артефакты копирования в Finder). Не импортируются (пути резолвятся к версиям
  без пробела). **2 из них закоммичены в git** и являются мёртвым трекнутым
  кодом: `frontend/src/lib/api/landing 2.ts`, `frontend/src/lib/lucide-icon 2.ts`.
  Остальные ~48 — untracked. Безопасны к удалению (не импортируются нигде).
- **eslint `no-unused-expressions`** в `EventsHero.tsx` (тернар-как-стейтмент
  `dx < 0 ? next() : prev();`, pre-existing паттерн) и `admin.tsx:1729`.
  Non-blocking: гейт сборки — `tsc --noEmit` (чист), `vite build` проходит;
  eslint в CI/деплое не запускается.

### Фаза 2b (иконки) — статические слоты подключены ✅ (2026-07-14)
- РЕШЕНО: `nav.*` слоты подключены через `<Icon slot={navSlotKey(section)} inheritColor>`
  во всех потребителях навигации (Sidebar обе колонки + «Маркет», BottomNav,
  бургер MobileHeader); `section.safe-deal` — в бейдже «Безопасная сделка»
  (`AdActionPanel`). `<Icon>` получил `inheritColor` (nav сохраняет active/inactive
  цвет от `currentColor` ссылки) и проброс `strokeWidth` (толщина активной вкладки
  BottomNav). Live-проверено: глифы без override не изменились, active/inactive
  цвет сохранён, override применяется к nav (Sidebar+BottomNav), fallback на lucide
  цел.
- `section.directions` НЕ заведён намеренно: у заголовков «Направления» нет иконки,
  слот был бы «мёртвым». Если нужна иконка рядом с «Направления» — отдельная правка.
- Оставшийся мелкий долг: `icon`-поля в массивах Sidebar/BottomNav/MOBILE_MENU_SECTIONS
  теперь vestigial (рендер идёт через ICON_SLOTS) — можно удалить в follow-up
  (оставлены, чтобы не плодить diff; держать в синхроне с ICON_SLOTS до удаления).

### Реальный режим — иконки заблокированы до бэкенда #26
- Публичный бутстрап `GET /icon-overrides` в НЕ-demo режиме отдаёт **404**
  (эндпоинт из `backend-endpoints-needed.md` #26 ещё не реализован). Ошибка
  ловится (`fetchIconOverrides` → `{}`), иконки корректно откатываются на lucide —
  **функционально безвредно**, НО в консоли на **каждой** странице в реальном
  режиме висит benign-404 до тех пор, пока Игорь не поднимет `#26`.
- Полный реальный тест загрузки иконок (POST /media purpose=icon, admin
  icon-assets, публикация) **невозможен до реализации `#26`** — это блокер именно
  для реального (не demo) теста иконок, а не дефект фронта. Demo-цикл проверен
  end-to-end (upload → sanitize/tokenize → reject multicolor → assign → publish →
  render в /feed → переживает reload).
