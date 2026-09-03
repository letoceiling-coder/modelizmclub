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

## `GET /users/me` answers 500 — public `{slug}` catch-all swallows unmatched paths

**Found:** 2026-09-03, while writing the post-deploy smoke check
(`deploy/scripts/smoke-check.sh`). The check picked `/users/me` as its
"authenticated route" probe and failed on the first run against production.

```
GET https://api.modelizmclub.ru/api/v1/users/me   (no token)
→ 500 {"message":"Server Error"}
```

Every other protected route behaves correctly:

```
users/me/listings         401
me/entity-requests        401
wallet                    401
account/payment-methods   401
```

**Cause.** There is no `GET users/me` route at all — `backend/app/Modules/User/routes/api.php`
declares `me/stats`, `me/settings`, `me/interests`, … under `auth:sanctum` and
`PATCH me` under `auth:sanctum,verified`, but no bare `GET me`. The request
therefore falls through to the public catch-all on line 63:

```php
Route::get('{slug}', ShowProfileController::class);
```

which treats `me` as a profile slug, finds no such user, and throws instead of
returning 404.

**Why this is worth a task of its own.** The bug is not the missing route —
it is that an unauthenticated catch-all sits at the end of the `users` prefix
and absorbs every path that did not match something explicit. Any future typo,
renamed route or client calling a path that no longer exists lands in
`ShowProfileController` and surfaces as a 500. `{slug}` has no `where()`
constraint, unlike the `{id}` routes above it which are guarded with
`->whereNumber('id')`. The same shape may exist under other prefixes.

Worth checking as part of the F3 routing audit:
- constrain `{slug}` (a slug pattern, or an explicit exclusion list of reserved
  words like `me`), so unmatched paths 404 instead of reaching a controller;
- make `ShowProfileController` return 404 for a missing profile rather than
  throwing;
- sweep the other module route files for unconstrained catch-alls.

**Not fixed** — recorded deliberately. The smoke check probes
`users/me/listings` instead, so the deploy gate does not depend on this bug
being resolved first.
