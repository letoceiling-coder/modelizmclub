# Modelizm Club — QA baseline (2026-08-01)

Источник требований: [`docs/qa/modelizm-test.pdf`](./modelizm-test.pdf) (49 стр., тесты №1–34 → 43 атомарные задачи).

## 1. Исходное состояние репозитория

| Параметр | Значение |
|----------|----------|
| Ветка | `master` |
| HEAD | `5ce68e3abfcd4941169ef77cd8b25d1a6dec1e62` |
| Последний commit | `fix(admin): skip SMS/email verification for staff in admin panel` |
| Автор | letoceiling-coder |

### git status (на момент аудита)

```
?? .tmp-modelizm-test-docx/
?? .tmp-modelizm-test.zip
?? deploy-guest-access.tar.gz
?? docs/qa/
```

Коммиченных незакоммиченных изменений в tracked-файлах **нет**. Untracked артефакты не трогались.

## 2. Структура monorepo

```
modelizmclub.ru/
├── backend/          Laravel 11 API (PostgreSQL, Redis, S3, Reverb)
├── frontend/         TanStack Start + React 19 + Vite/Nitro
├── docs/             Планы, OpenAPI, QA
├── deploy/           Скрипты деплоя VPS
└── node_modules/     Playwright (transitive), без корневого package.json
```

| Компонент | Package manager | Runtime |
|-----------|-----------------|---------|
| Frontend | **Bun** (`bun.lock`) | Node v24.16.0, Bun 1.3.14 |
| Backend | **Composer** | PHP 8.3.31 |

> README: локально проект **не разворачивается**; рабочий цикл — push → deploy на VPS (`31.207.75.124`). Production: https://modelizmclub.ru, API dev: https://dev.modelizmclub.ru.

## 3. Прочитанная документация

| Документ | Назначение |
|----------|------------|
| `README.md` | Структура, деплой, окружения |
| `docs/PLAN-DB-API.md` | План БД/API |
| `docs/AUDIT-TZ-2026-07-02.md` | Аудит vs ТЗ |
| `deploy/README.md` | VPS setup |
| `docs/openapi/README.md` | OpenAPI |
| `backend/README.md` | Стандартный Laravel README (без project-specific) |

**Не найдено:** `AGENTS.md`, `CLAUDE.md`, `CURSOR.md`, отдельные правила миграций (кроме Laravel conventions).

## 4. Карта архитектуры (high-level)

### Frontend (TanStack Router)

Ключевые маршруты:

| Область | Routes |
|---------|--------|
| Лента | `/feed` |
| Мессенджер | `/messenger` |
| Объявления | `/ads`, `/ads/new`, `/ads/$id`, `/my-ads` |
| Профиль | `/profile`, `/user/$id` |
| Каналы | `/channels`, `/channel/$id` |
| Обзоры | `/reviews`, `/reviews/$id`, `/reviews/upload` |
| Уведомления | `/notifications` |
| Направления | `/categories`, `/categories/$id`, `/categories/$id/$subId` |
| Админка | `/admin`, `/admin/listings/$uuid`, `/admin/design-system` |
| Настройки | `/settings/*` |

i18n: `frontend/src/lib/i18n` — `ru`, `en`, `zh` (react-i18next).

Real-time: Laravel Echo + Reverb (`frontend/src/lib/realtime/`), presence channel `online`.

### Backend modules (`backend/app/Modules/`)

| Модуль | Ответственность |
|--------|-----------------|
| Auth | Login, register, OAuth, SMS/email verification |
| User | Profile, friends, notifications, presence heartbeat |
| Feed | Posts, comments, reactions, schedule/publish |
| Listing | Ads CRUD, moderation, boost, placement |
| Chat | Conversations, messages, room chats |
| Call | LiveKit calls |
| Video | Reviews (video module) |
| Channel | Channels, channel posts |
| Community | Communities |
| Admin | Dashboard, moderation, settings, banners, listings |
| Media | Upload sessions, S3 |
| Catalog | Categories (post/listing/community trees) |
| Billing | Wallet, subscriptions, payments |
| Delivery | CDEK/Yandex shipments |
| Report | User reports |
| PublicContent | Landing, feed guest access |

### Авторизация и роли

- Sanctum tokens (frontend localStorage/sessionStorage)
- Spatie permissions + `UserRole`: admin, moderator, user
- Middleware `verified` → `EnsureFullyVerified` (email + phone; staff bypass для admin/moderator)
- Admin routes: `auth:sanctum` + `role:admin|moderator`

### Модерация и публикация

- Posts: `ContentStatus`, `feature.feed_auto_publish` SystemSetting, cron `posts:publish-scheduled`
- Listings: `moderation_auto_publish` SystemSetting
- Admin moderation queue: `/admin/moderation/*`

### Real-time

- Laravel Reverb + Echo
- Global presence: channel `online`
- Chat events: `MessageSent`, etc.

### Scheduler (`backend/routes/console.php`)

- `notifications:prune` — daily
- `posts:publish-scheduled` — every minute

### Shared UI (релевантно PDF)

- `frontend/src/components/ads/wizard/ImageUploadGrid.tsx` — загрузчик фото (feed/ads/channel)
- `frontend/src/components/feed/BannerHeroSlide.tsx` — баннер ленты
- `frontend/src/components/CreatePostForm.tsx` — создание поста

## 5. Baseline проверки (локально, 2026-08-01)

### Frontend

| Команда | Результат | Примечание |
|---------|-----------|------------|
| `cd frontend && bun run lint` | **FAIL** (exit 1) | Массовые `prettier/prettier` CRLF (`Delete ␍`) — **pre-existing**, не связано с QA-работой |
| `bun run build` | **PASS** (последняя успешная сборка в сессии ~3m) | SSR + client |
| `typecheck` | **N/A** | Скрипт отсутствует в `frontend/package.json` |
| Playwright E2E | **N/A** | Нет `playwright.config` в корне репо; Playwright только в `node_modules` |

### Backend

| Команда | Результат | Примечание |
|---------|-----------|------------|
| `php artisan test` | **FAIL** (bootstrap) | `could not find driver (Connection: sqlite)` — локально нет pgsql/sqlite PDO |
| `php artisan migrate --pretend` | Не запускалось | Нет локального `.env` с БД |

### Deploy scripts (reference)

```bash
ssh root@31.207.75.124 "cd /var/www/modelizmclub && bash deploy/scripts/deploy-dev.sh && bash deploy/scripts/deploy-frontend.sh"
```

Известная pre-existing проблема deploy: `DemoListingsSeeder` падает на duplicate slug (не блокирует миграции).

## 6. Pre-existing vs QA scope

| Проблема | Классификация |
|----------|---------------|
| ESLint CRLF на Windows | Pre-existing tooling |
| PHPUnit без DB driver локально | Pre-existing env limitation |
| DemoListingsSeeder на prod deploy | Pre-existing ops |
| Нет E2E harness в репо | Gap — задача 43 предусматривает минимальный Playwright |

## 7. Частично затронутые области (до старта QA-цикла)

Следующие изменения уже были в `master` до formal QA; требуют **перепроверки по PDF**, не считаются VERIFIED:

| PDF / Task | Что уже менялось | Риск регрессии |
|------------|------------------|----------------|
| №28 / Task 11 | Баннер: убран `line-clamp`, высота стала `min-h` (растёт с текстом) | **Конфликт с PDF** — нужна фиксированная высота + line-clamp |
| №9 / Task 7 | Notifications: undo toast, delayed delete | Нужна проверка persist после refresh |
| №27 / Task 41 (feed only) | Scheduled posts для ленты, не для обзоров | Обзоры — отдельная задача |
| №21 / Task 9 | Communities toggle в admin settings | Нужна проверка end-to-end |
| Staff SMS bypass | Admin/moderator skip verification | Вне scope PDF, но влияет на admin UX |

## 8. Следующий шаг

1. Матрица: [`modelizm-43-fixes.md`](./modelizm-43-fixes.md)
2. Этап A, задача 1: аудит `ImageUploadGrid` и потребителей (`/feed`, `/ads/new`, `/channel/...`)
3. E2E baseline — добавить минимальный Playwright config (задача 43, по мере необходимости)

---

*Baseline зафиксирован до начала правок по PDF. Обновлять после каждого этапа.*
