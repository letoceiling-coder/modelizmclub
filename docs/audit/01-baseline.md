# Baseline — 03.09.2026

Замеры на `origin/master` @ `ecb4d60`. Прод — `4dd1901` (содержимое идентично,
расходятся только хеши). Ничего не правилось: `bun.lock`, изменённый при
установке зависимостей, возвращён в исходное состояние.

## Сводная таблица

| Метрика | 03.09.2026 | Цель |
|---|---|---|
| `tsc --noEmit`, ошибок | **84** | 0 |
| ESLint, всего | **8508** (8433 err / 75 warn) | 0 |
| ESLint без `prettier/prettier` | **92** | 0 |
| Сборка фронта | **127 с**, из репозитория **не собирается** (см. ниже) | собирается, < 3 мин |
| Клиентский JS, суммарно | **5716 КБ** raw в 127 чанках | — |
| Чанков > 200 КБ | **4** | 0—1 |
| Крупнейший чанк | `index` — 2268 КБ raw / **668 КБ gzip** | < 250 КБ gzip |
| Тесты фронта | **отсутствуют** (0 файлов, нет раннера) | есть |
| Неиспользуемые зависимости | **8** | 0 |
| PHPUnit | **392 passed, 5 failed** (2083 assertions) | 0 failed |
| `composer audit` | **24 advisories / 4 пакета** | 0 medium+ |
| Эндпоинтов API | 441 | — |
| Моделей / миграций | 103 / 84 | — |
| Контроллеров / сервисов | 270 / 94 | — |
| **Policies** | **1** | по числу изменяющих ресурсов |
| Performance (Lighthouse) | не измерено — CLI не установлен | > 80 |
| CLS / FCP / LCP | не измерено | < 0.1 / < 1.5 с / < 2.5 с |

## Frontend

### TypeScript — 84 ошибки

| Файл | Ошибок |
|---|---|
| `frontend/src/lib/i18n/locales/zh.ts` | 15 |
| `frontend/src/lib/i18n/locales/en.ts` | 12 |
| `frontend/src/routes/admin.tsx` | 10 |
| `frontend/src/lib/api/feed.ts` | 7 |
| `frontend/src/routes/reviews.$id.tsx` | 4 |
| `frontend/src/components/PostCard.tsx` | 4 |
| `frontend/src/routes/register.tsx` | 3 |
| `frontend/src/routes/ads.new.tsx` | 3 |
| `frontend/src/lib/realtime/presence.ts` | 3 |
| `frontend/src/routes/settings.consents.tsx` | 2 |

По кодам: `TS2322` 15, `TS2353` 10, `TS2345` 10, `TS2741` 7, `TS2739` 6.

Значительная часть — рассинхрон словарей локализации (`zh`/`en` против `ru`)
и обязательные search-параметры маршрутов (`TS2741`/`TS2345` на `<Link>`).

### ESLint — 8508, из них 8416 форматирование

| Правило | Срабатываний |
|---|---|
| `prettier/prettier` | **8416** |
| `react-hooks/exhaustive-deps` | 37 |
| `react-refresh/only-export-components` | 32 |
| `@typescript-eslint/no-explicit-any` | 8 |
| ошибки парсинга | 6 |
| `no-useless-escape` | 3 |
| `@typescript-eslint/no-unused-expressions` | 2 |
| `react-hooks/rules-of-hooks` | **2** |
| `jsx-a11y/alt-text` | 1 |
| `prefer-const` | 1 |

> Цель «0 eslint» достигается запуском `prettier --write` — 99% объёма это
> форматирование. Содержательных замечаний **92**, и среди них
> `react-hooks/rules-of-hooks` (2 шт.) — нарушение правил хуков, потенциальная
> причина падений в рантайме.

Топ файлов: `routes/admin.tsx` 959, `components/PostCard.tsx` 368,
`lib/i18n/locales/en.ts` 265, `lib/mock.ts` 256, `lib/i18n/locales/zh.ts` 255.

### Сборка — из репозитория не собирается

```
[@tailwindcss/vite] Can't resolve '@fontsource-variable/manrope'
bun install --frozen-lockfile → error: lockfile had changes, but lockfile is frozen
```

`frontend/package.json` объявляет три пакета `@fontsource*`, в
`frontend/bun.lock` их **нет**. Следствия:

1. `bun install --frozen-lockfile` падает всегда;
2. `deploy-frontend.sh` имеет фолбэк `|| bun install`, который переписывает
   lock прямо на сервере — это и есть вечно «грязный» `frontend/bun.lock`
   в `git status` прода и в 26 стэшах `pre-pull-*`;
3. воспроизводимость сборки нарушена: ставится не то, что зафиксировано.

После `bun install` сборка проходит за **127 с** (клиент 49 с + SSR/nitro).

### Бандл

| Чанк | raw | gzip |
|---|---|---|
| `index-*.js` | 2268 КБ | **668 КБ** |
| `heic2any-*.js` | 1324 КБ | 333 КБ |
| `LiveKitRoomUI-*.js` | 624 КБ | 169 КБ |
| `admin-*.js` | 300 КБ | 61 КБ |
| `messenger-*.js` | 88 КБ | 22 КБ |

Всего 127 чанков, 5716 КБ raw. `.output` 27 МБ (public 18 МБ, server 9.7 МБ).

`heic2any` (1.3 МБ) — конвертер HEIC, нужен единицам пользователей на iOS,
но лежит отдельным чанком в клиенте. `index` в 668 КБ gzip — главный кандидат
на разбиение.

### Тесты и зависимости

Тестов на фронте **нет**: ни `test`-скрипта, ни раннера в `devDependencies`,
ни одного `*.test.*` / `*.spec.*`.

Неиспользуемые зависимости (depcheck), 8:
`@fontsource-variable/manrope`, `@fontsource-variable/space-grotesk`,
`@fontsource/ibm-plex-mono`, `@hookform/resolvers`, `@tanstack/router-plugin`,
`date-fns`, `tailwindcss`, `tw-animate-css`.

> Три `@fontsource*` и `tailwindcss` подключаются через CSS-импорты в
> `styles.css`, depcheck этого не видит — ложные срабатывания. Реально
> под вопросом `@hookform/resolvers` и `date-fns`.

## Backend

### PHPUnit — 392 passed, 5 failed

Прогон через `deploy/scripts/run-backend-tests.sh` на изолированной
`modelizmclub_test`, 47 с, 2083 assertions.

| Падает | Файл |
|---|---|
| `published listing update re moderates when auto publish disabled` | `tests/Feature/ListingCreateValidationTest.php` |
| `published listing update re moderates even when auto publish enabled` | `tests/Feature/ListingCreateValidationTest.php` |
| `admin can create auto assign pool and counter increments` | `tests/Feature/PromoPoolAndReferralRewardTest.php` |
| `pool stops granting after limit` | `tests/Feature/PromoPoolAndReferralRewardTest.php` |
| `register reads referral cookie and click is counted` | `tests/Feature/PromoPoolAndReferralRewardTest.php` |

Все пять — вокруг модерации листингов и промо-пулов/рефералов.

### composer audit — 24 advisories на 4 пакета

| Пакет | Advisories |
|---|---|
| `league/commonmark` | 10 |
| `guzzlehttp/guzzle` | 9 |
| `laravel/framework` | 3 |
| `guzzlehttp/psr7` | 2 |

Самая свежая — `CVE-2026-71478` (medium) в `league/commonmark`: обход фильтра
небезопасных ссылок через управляющие байты в `href`/`src`. Затронуты версии
`>=1.5.0,<=2.8.3`.

### Объём и маршруты

441 маршрут: GET 175, POST 170, DELETE 55, PATCH 37, PUT 17.

| Middleware | Маршрутов |
|---|---|
| `api` | 431 |
| `auth:sanctum` | 352 |
| `EnsureUserRole:admin` | 138 |
| `EnsureFullyVerified` | 107 |
| `EnsureCommunitiesEnabled` | 18 |
| `EnsureUserRole:moderator,admin` | 15 |

103 модели, 84 миграции, 270 контроллеров, 94 сервиса, 19 модулей,
83 тестовых файла — и **1 policy**.

> Авторизация держится на middleware по ролям, а не на policy/gate по объекту.
> Проверка владения ресурсом, если она есть, живёт внутри контроллеров и
> сервисов. Для аудита IDOR это ключевой факт: единая точка, где такие
> проверки можно было бы увидеть, отсутствует.

### Самые большие файлы

| Backend | Строк |
|---|---|
| `backend/app/Modules/Billing/Services/SafeDealService.php` | 1137 |
| `backend/app/Modules/Chat/Services/ChatService.php` | 1044 |
| `backend/app/Modules/Auth/Services/MaxAuthService.php` | 938 |
| `backend/app/Console/Commands/SimulateActivityCommand.php` | 832 |
| `backend/app/Modules/Listing/Services/ListingService.php` | 805 |

| Frontend | Строк |
|---|---|
| `frontend/src/routes/admin.tsx` | 4427 |
| `frontend/src/lib/i18n/locales/en.ts` | 3446 |
| `frontend/src/lib/i18n/locales/zh.ts` | 3401 |
| `frontend/src/lib/i18n/locales/ru.ts` | 3313 |
| `frontend/src/routes/messenger.tsx` | 1846 |
| `frontend/src/lib/api/admin.ts` | 1772 |

## Антипаттерны из аудита 22.08

| Антипаттерн | Вхождений | Топ-файлы |
|---|---|---|
| `window.location.reload()` | **0** | — |
| framer-motion `layout` / `layoutId` | **4** | `components/ads/wizard/ImageUploadGrid.tsx` (2), `routes/my-ads.tsx`, `routes/communities.$id.tsx` |
| классы `animate-*` | **93** | `components/ui/navigation-menu.tsx` (6), `ui/sheet.tsx` (4), `ui/dropdown-menu.tsx` (4), `ui/dialog.tsx` (4), `ui/context-menu.tsx` (4), `ui/alert-dialog.tsx` (4), `components/admin/AdminBillingOpsCard.tsx` (4) |
| прямые импорты shadcn `Card`/`Tabs`/`Dialog` | **48** | `routes/settings.wallet.tsx` (2), `routes/deals.$uuid.tsx` (2), `routes/communities.$id.tsx` (2), `components/media/PhotoEditorDialog.tsx` (2), далее по 1 |
| точные px в отступах (`p-[12px]` и т.п.) | **2254** | `routes/communities.$id.tsx` (137), `routes/profile.tsx` (96), `routes/categories.$id.$subId.tsx` (80), `routes/messenger.tsx` (78), `routes/deals.$uuid.tsx` (56), `routes/ads.new.tsx` (55), `routes/admin.tsx` (51) |
| `any` / `@ts-ignore` | **92** | `routeTree.gen.ts` (75, генерируется), `lib/calls.ts` (8), `lib/realtime/echo.ts` (7) |
| `useEffect` + fetch вместо TanStack Query | **85** | `routes/user.$id.tsx`, `routes/settings.*` (6 файлов), `routes/reviews.upload.tsx` (2), `routes/reviews.index.tsx`, `routes/profile.tsx` |

Контекст к последней строке: `useQuery`/`useMutation`/`useInfiniteQuery` —
**28** вхождений против **335** `useEffect`. Загрузка данных в проекте
преимущественно императивная; TanStack Query подключён, но используется
точечно.

Замечания по остальным строкам:

- `window.location.reload()` — 0. Антипаттерн из аудита 22.08 устранён.
- `animate-*` — 93, но подавляющее большинство внутри `components/ui/*`,
  то есть в неизменённых компонентах shadcn. Своего кода это почти не касается.
- `any` — 92, из них 75 в `routeTree.gen.ts`, который генерируется сборкой.
  Реальных 17.
- 2254 точных px — самый массовый пункт. Это прямое препятствие для мобильной
  адаптации: фиксированные отступы не масштабируются между брейкпоинтами.

## Что не измерено

- **Lighthouse** (`02-lighthouse-2026-09-03.md`) — CLI не установлен локально.
  Требуется `npm i -g lighthouse` либо прогон через Chrome DevTools.
  Отдельный файл будет создан после установки.
- Покрытие тестами фронта — измерять нечего, тестов нет.
- Покрытие бэкенда — `--coverage` требует Xdebug/PCOV, на сервере не проверял,
  чтобы не менять конфигурацию PHP.
