# План интеграции фронта с API, медиа-пайплайна и real-time

> Версия: 1.0 · 26.06.2026  
> Цель: [modelizmclub.ru](https://modelizmclub.ru) работает **только через API и БД**, без mock-данных; admin, чаты и статусы — в онлайн-режиме.  
> Базовый аудит: фронт 32 маршрута, **0 HTTP-вызовов к API**; бэкенд ~94 маршрута в 7 модулях; E2-модули (Listings, Chat, Billing, Public) — **не реализованы**.

---

## 1. Исполнительное резюме

| Область | Сейчас | Цель |
|---------|--------|------|
| Данные на фронте | `mock.ts`, `store.ts`, `channels.ts`, localStorage | PostgreSQL + Redis + S3 |
| API-интеграция | `lib/api/config.ts` не используется | React Query + Sanctum, все страницы |
| Медиа | Локальные `/demo/posts/*.jpg`, DiceBear avatars | S3 + обработка WebP + `<picture>` |
| Real-time | Нет | Laravel Reverb + presence/typing/read |
| Admin `/admin` | 100% mock UI | Admin API + расширения под UI |
| Тесты | 6 feature-файлов, ~15 сценариев | CRUD по каждому модулю + контрактные тесты фронт↔API |

**Оценка объёма:** 4–6 месяцев при 1 full-stack + 1 DevOps (или 10–14 спринтов по 2 недели).

---

## 2. Целевая архитектура

### 2.1 Домены и сервисы

```
Internet
  │
  ├── modelizmclub.ru          → Frontend (TanStack Start / Nitro, :3000)
  ├── api.modelizmclub.ru      → Laravel API (production)
  ├── cdn.modelizmclub.ru      → nginx → Selectel S3 (готовые варианты изображений)
  ├── ws.modelizmclub.ru       → Laravel Reverb (WebSocket)
  └── img.modelizmclub.ru      → Media Processor (микросервис, internal + health)
```

| Поддомен | Назначение | Технология |
|----------|------------|------------|
| `modelizmclub.ru` | SSR/SPA, SEO-лендинг | Nitro node-server, nginx |
| `api.modelizmclub.ru` | REST API v1, Swagger | Laravel 11, PHP-FPM |
| `cdn.modelizmclub.ru` | Публичная раздача медиа (immutable URLs) | nginx proxy / S3 public bucket или signed CDN |
| `ws.modelizmclub.ru` | Чаты, presence, уведомления, модерация live | Reverb + Redis |
| `img.modelizmclub.ru` | Обработка загрузок (internal) | Worker-сервис (см. §3) |

> Dev остаётся на `dev.modelizmclub.ru` до cutover; затем `VITE_API_BASE_URL=https://api.modelizmclub.ru/api/v1`.

### 2.2 Поток медиа (обязательная обработка)

```
1. Client → POST /api/v1/media/upload-session { purpose, files[] }
2. API → presigned PUT → S3 tmp/{session}/{uuid}.orig
3. Client → загрузка в S3
4. Client → POST /api/v1/media/confirm { session_uuid, media_uuids[] }
5. API → dispatch ProcessMediaJob → Redis queue
6. Media Processor:
   - verify hash, strip EXIF (privacy)
   - resize: thumb 320w, medium 800w, large 1600w
   - encode: WebP (primary) + JPEG (fallback)
   - upload variants → S3 media/{uuid}/{variant}.{ext}
   - update media.status=ready, media.variants JSON
7. CDN URLs в API-ответах:
   - webp: https://cdn.modelizmclub.ru/media/{uuid}/medium.webp
   - jpeg: https://cdn.modelizmclub.ru/media/{uuid}/medium.jpg
```

### 2.3 Формат `<picture>` на фронте

Компонент `ResponsiveImage`:

```tsx
<picture>
  <source type="image/webp" srcSet={`${cdn}/medium.webp 800w, ${cdn}/large.webp 1600w`} sizes="(max-width:768px) 100vw, 680px" />
  <source type="image/jpeg" srcSet={`${cdn}/medium.jpg 800w, ${cdn}/large.jpg 1600w`} sizes="..." />
  <img src={`${cdn}/medium.jpg`} alt={alt} loading="lazy" decoding="async" width={w} height={h} />
</picture>
```

API `MediaResource` возвращает:

```json
{
  "uuid": "...",
  "variants": {
    "thumb": { "webp": "...", "jpeg": "..." },
    "medium": { "webp": "...", "jpeg": "..." },
    "large": { "webp": "...", "jpeg": "..." }
  },
  "width": 1600,
  "height": 1200,
  "blurhash": "..."
}
```

### 2.4 Media Processor — варианты реализации

| Вариант | Плюсы | Минусы | Рекомендация |
|---------|-------|--------|--------------|
| **A. Laravel Queue + libvips** (Intervention Image v3) | Один репозиторий, проще деплой | PHP CPU-bound | **MVP (фаза 2)** |
| **B. Отдельный Go/Node worker** (`img/` сервис) | Масштабирование, изоляция | +1 сервис, мониторинг | **Фаза 2.5** при нагрузке |
| **C. imgproxy как sidecar** | Готовый resize on-the-fly | Нет persist WebP в S3 | Только как CDN-cache layer |

**Рекомендация:** начать с **A**, вынести в **B** когда очередь > 30s p95.

Структура монорепо (добавить):

```
modelizmclub/
├── backend/           # Laravel API + ProcessMediaJob
├── media-processor/   # (фаза 2.5) HTTP consumer или SQS-совместимая очередь
├── frontend/
└── deploy/nginx/      # cdn, api, ws vhosts
```

---

## 3. Real-time (WebSockets)

### 3.1 Стек

- **Laravel Reverb** на `ws.modelizmclub.ru`
- **Redis** — presence, broadcasting
- **Sanctum** — auth для private channels (`Bearer` при WS handshake)
- **События:** `MessageSent`, `MessageRead`, `UserOnline`, `PostPublished`, `ModerationUpdated`, `NotificationReceived`

### 3.2 Каналы

| Channel | События | Страницы |
|---------|---------|----------|
| `private-user.{id}` | notifications, friend request, subscription | profile, friends |
| `private-conversation.{uuid}` | messages, typing, read receipts | messenger |
| `presence-category.{slug}` | online count | categories/$id/$subId |
| `private-admin.moderation` | queue updates | admin/moderation |

### 3.3 Фронт

- `@laravel/echo` + `pusher-js` (Reverb-compatible)
- React Query `invalidateQueries` на WS-события
- Optimistic UI для сообщений/реакций

---

## 4. Маппинг mock → БД (seed)

### 4.1 Сущности из `mock.ts`

| Mock | Таблицы БД | Seeder | API-модуль |
|------|------------|--------|------------|
| `users` (8) | users, profiles, user_profiles | `DemoUsersSeeder` | User ✅ |
| `me` | текущий demo-user | ReferenceDataSeeder ✅ | Auth ✅ |
| `categories` + sub | post_categories, community_subcategories | расширить ReferenceDataSeeder | Catalog ✅ |
| `posts` (22) | posts, post_media, post_hashtags, comments | `DemoFeedSeeder` | Feed ✅ |
| `ads` | listings, listing_media | `DemoListingsSeeder` | Listing ❌ |
| `communities` (4) | communities, community_members | ReferenceDataSeeder ✅ | Community ✅ |
| `banners` | banners | ReferenceDataSeeder ✅ | Admin + public ❌ |
| `tariffs` / `subscriptionPlans` | subscription_plans | ReferenceDataSeeder ✅ | Billing public ❌ |
| `dialogs`, `chatMessages` | conversations, messages | `DemoChatSeeder` | Chat ❌ |
| `friendRequests` | user_follows или friend_requests* | `DemoSocialSeeder` | Friends ❌ |
| `faqItems`, `faqCategories` | faq_articles, faq_categories | `DemoFaqSeeder` | Support ❌ |
| `adminStats`, `adminActions`, `adminUsers` | audit_logs, aggregates | `DemoAdminSeeder` | Admin partial |
| `promoCodes` | promocodes | ReferenceDataSeeder ✅ | Admin ✅ |
| `firstHundredStats` | system_settings / promo campaign | settings key | Public ❌ |

\* **ADR:** «Друзья» на фронте = follow + optional friend_requests table. Решение: Phase 1 — follow API; Phase 2 — friend_requests если нужен UX заявок.

### 4.2 Данные вне mock.ts

| Источник | Решение |
|----------|---------|
| `channels.ts` | Новые таблицы `channels`, `channel_posts`, `channel_subscriptions` **или** переиспользовать communities — **продуктовое решение** |
| `calls.ts` | Отложить (E3) или stub «скоро» |
| `referral.ts` | `bonus_accounts`, referral_codes в billing |
| DiceBear avatars | Seed → media upload placeholder или generated avatars в S3 |
| `/demo/posts/*.jpg` | Загрузить в S3 через artisan, привязать к demo posts |

### 4.3 Единый seeder

```bash
php artisan db:seed --class=FullDemoSeeder
# включает: ReferenceDataSeeder + DemoFeedSeeder + DemoListingsSeeder
#           + DemoChatSeeder + DemoFaqSeeder + DemoMediaAssetsSeeder
```

Команда `deploy/scripts/reset-demo-user.sh` — обновить под полный demo-набор.

---

## 5. Пробелы бэкенда (что дописать)

### 5.1 Критический путь (блокирует «без mock»)

| # | Модуль | Endpoints | Зависимости |
|---|--------|-----------|-------------|
| 1 | **Media pipeline** | ProcessMediaJob, variants, DELETE media | S3, queue, cdn vhost |
| 2 | **Public** | GET /public/banners, /plans/compare, /public/stats, /legal/{slug} | seed |
| 3 | **Listings** | полный §5.6 PLAN-DB-API | listings tables ✅ |
| 4 | **Chat** | §5.7 + Reverb | chat tables ✅ |
| 5 | **Billing public** | §5.8 | billing tables ✅ |
| 6 | **Friends** | GET /users/me/following, followers; POST friend request | user_follows |
| 7 | **Channels** | CRUD или cut feature | ADR |
| 8 | **Reports** | POST /reports (user), PATCH /admin/reports/{id} | reports table |
| 9 | **Feed extras** | GET /users/{slug}/posts, GET /users/me/bookmarks | Feed ✅ base |
| 10 | **Admin extensions** | content index, analytics, notifications, community apply review, listing moderation | см. §5.2 |

### 5.2 Admin API ↔ `/admin` (frontend)

| Вкладка UI | Новые/расширенные endpoints |
|------------|----------------------------|
| Дашборд | time-series registrations, revenue; GET /admin/dashboard/chart |
| Пользователи | POST /admin/users/{id}/block, GET /admin/users/{id}/detail |
| Контент | GET /admin/posts, PATCH status |
| Объявления | GET /admin/listings, moderation actions |
| Модерация | + listings queue, community applications |
| Монетизация | ✅ plans/promos/banners |
| Категории | ✅ |
| Уведомления | CRUD email_templates, POST /admin/notifications/broadcast |
| Аналитика | GET /admin/analytics (DAU, revenue, posts/day) |
| Настройки | расширить system_settings groups |

### 5.3 OAuth

- VK ID, Yandex ID — рабочие callback (сейчас 501 stub)

---

## 6. Интеграция фронта

### 6.1 Инфраструктура клиента

```
frontend/src/lib/api/
├── config.ts          # base URL, CDN URL
├── client.ts          # fetch wrapper, 401 → logout
├── auth.ts            # token storage, sanctum cookie mode
├── query-keys.ts
├── hooks/             # useFeed, usePost, ...
├── types/             # generated from OpenAPI (optional)
└── components/
    └── ResponsiveImage.tsx
```

- `@tanstack/react-query` — уже подключён, использовать
- OpenAPI codegen: `openapi-typescript` из `docs/openapi/openapi.json`
- **CORS:** `api.modelizmclub.ru` → `modelizmclub.ru`
- Env: `VITE_API_BASE_URL`, `VITE_CDN_BASE_URL`, `VITE_REVERB_*`

### 6.2 Порядок замены mock по страницам

| Фаза | Страницы | Удалить |
|------|----------|---------|
| F1 | login, register, recover, onboarding | mock auth |
| F2 | feed, profile, user/$id | mock posts/users |
| F3 | communities/*, categories/* (без room chat) | mock communities |
| F4 | ads/* | mock ads + store ads |
| F5 | messenger, categories/$id/$subId | mock dialogs + store |
| F6 | friends, subscription, help | mock social/billing/faq |
| F7 | admin | mock admin |
| F8 | channels/* | channels.ts или cut |
| F9 | landing, / | hardcoded → public API |
| F10 | calls, referral | defer or billing |

**Критерий готовности страницы:** `grep mock` в route = 0; все данные из useQuery; e2e smoke pass.

### 6.3 Удаление mock-файлов (финал)

```
Удалить: mock.ts, store.ts, channels.ts (если API), referral.ts mock parts
Оставить: types/ (перенести в api/types), showcase-images → CDN
```

---

## 7. План фаз (roadmap)

### Фаза 0 — Foundation (1–2 недели)

- [ ] DNS: `api.`, `cdn.`, `ws.` → VPS
- [ ] nginx vhosts + SSL
- [ ] Production `.env`: API URL на фронте
- [ ] CORS, Sanctum SPA config
- [ ] `api/client.ts`, auth flow, React Query provider hooks
- [ ] CI: backend tests + frontend lint/build

**DoD:** login → token → GET /auth/me работает с фронта.

---

### Фаза 1 — Auth + Users + Seed v2 (2 недели)

- [ ] OAuth VK/Yandex
- [ ] DemoMediaAssetsSeeder (demo photos → S3)
- [ ] DemoFeedSeeder (22 поста из mock)
- [ ] Profile: GET/PATCH /users/me, GET /users/{slug}
- [ ] GET /users/{slug}/posts, GET /users/me/bookmarks
- [ ] Frontend: login, register, recover, onboarding, profile, user/$id
- [ ] Tests: AuthFlow, UserModule расширить

**DoD:** /feed и /profile без mock users/posts.

---

### Фаза 2 — Media Pipeline + CDN (2–3 недели)

- [ ] ProcessMediaJob (libvips/intervention)
- [ ] media.variants schema, MediaResource с picture URLs
- [ ] `cdn.modelizmclub.ru` nginx → S3
- [ ] ResponsiveImage component
- [ ] Upload в CreatePost, profile avatar, ads photos
- [ ] DELETE /media/{uuid}
- [ ] Tests: variants created, webp+jpeg exist

**DoD:** загрузка фото пользователем → WebP на CDN → `<picture>` в ленте.

---

### Фаза 2.5 — Media Processor microservice (опционально, 1–2 недели)

- [ ] `media-processor/` service
- [ ] Consume Redis queue, horizontal scale
- [ ] Health checks, dead letter queue

---

### Фаза 3 — Feed + Public + Communities (2 недели)

- [ ] Feed filters, banners public API
- [ ] Public landing/stats/legal
- [ ] Communities pages → API
- [ ] Categories tree → API (без room chat)
- [ ] Tests: FeedModule, CatalogCommunity расширить

**DoD:** /feed, /communities, /categories без mock.

---

### Фаза 4 — Listings / Ads (2–3 недели)

- [ ] Listing module (CRUD, submit, publish, sold, similar)
- [ ] Listing moderation in admin
- [ ] DemoListingsSeeder из mock ads
- [ ] Frontend: /ads, /ads/new, /ads/$id
- [ ] Tests: ListingModuleTest (full CRUD)

**DoD:** объявления end-to-end с фото.

---

### Фаза 5 — Real-time Chat (3–4 недели)

- [ ] Chat module API
- [ ] Reverb setup `ws.modelizmclub.ru`
- [ ] DemoChatSeeder
- [ ] Frontend messenger + category room chat
- [ ] Presence online counts
- [ ] Tests: ChatTest + broadcast fake

**DoD:** сообщения доставляются без refresh; online count live.

---

### Фаза 6 — Billing + Subscription (2 недели)

- [ ] Public plans, subscriptions/me, promocode validate
- [ ] Payment provider integration (YooKassa/VTB — stub → prod)
- [ ] Referral/bonus API
- [ ] Frontend /subscription
- [ ] Tests: BillingTest

---

### Фаза 7 — Admin integration (3 недели)

- [ ] Расширить Admin API (§5.2)
- [ ] Переписать admin.tsx на React Query + admin endpoints
- [ ] Real-time moderation queue (Reverb)
- [ ] Analytics endpoints
- [ ] Tests: AdminModuleTest full CRUD coverage

**DoD:** [modelizmclub.ru/admin](https://modelizmclub.ru/admin) — live data.

---

### Фаза 8 — Social + Support + Polish (2 недели)

- [ ] Friends/follow UX
- [ ] FAQ/support tickets
- [ ] Reports от пользователей
- [ ] Channels (или feature flag off)
- [ ] Notifications API + WS

---

### Фаза 9 — QA + Cutover (2 недели)

- [ ] Удалить mock.ts, store.ts
- [ ] E2E Playwright: все 32 маршрута
- [ ] Load test media queue
- [ ] Switch prod API to api.modelizmclub.ru
- [ ] Security review, rate limits

---

## 8. Матрица тестов

### 8.1 Backend (PHPUnit) — целевое покрытие

| Module | Tests to add |
|--------|--------------|
| Auth | OAuth mock, password reset edge cases |
| User | bookmarks list, blocks, posts by slug |
| Feed | react, repost, bookmark list, delete |
| Media | upload, process job, variants, delete |
| Listing | full lifecycle + moderation |
| Chat | create conversation, send, read, WS event |
| Billing | subscribe, promocode, webhook |
| Admin | each CRUD resource + analytics |
| Public | landing, banners, legal |

**CI gate:** `php artisan test` 100% pass; min 80% critical path coverage.

### 8.2 Frontend

| Type | Tool | Scope |
|------|------|-------|
| Unit | Vitest | api client, hooks, ResponsiveImage |
| E2E | Playwright (`frontend/tests/`) | 32 routes, auth flows, upload |
| Contract | OpenAPI diff | breaking change detection |

### 8.3 Smoke после деплоя

```bash
bash deploy/scripts/smoke-auth.sh
bash deploy/scripts/smoke-feed.sh
bash deploy/scripts/verify-api-crud.sh
bash deploy/scripts/smoke-media-cdn.sh   # новый
bash deploy/scripts/smoke-ws.sh          # новый
```

---

## 9. Риски и решения

| Риск | Митигация |
|------|-----------|
| Объём E2 модулей | Строгая фазировка; channels/calls — cut или E3 |
| picsum/Lovable CDN | Уже заменены локальными demo; seed → S3 |
| ID slug vs uuid | Frontend routes: slug для users/communities, uuid для posts/listings |
| «Друзья» ≠ follow | ADR + UX согласование в F8 |
| CPU на обработке фото | Queue + media-processor scale |
| WebSocket за nginx | proxy_pass Upgrade headers для ws. |

---

## 10. ADR — решения, требующие подтверждения

1. **Channels** — отдельная сущность или alias communities?
2. **Friends** — follow-only или friend_requests?
3. **CDN** — public bucket vs signed URLs
4. **Payment provider** — YooKassa vs VTB для MVP
5. **api.modelizmclub.ru** vs продолжать dev API для prod фронта

---

## 11. Чеклист «без mock» (Definition of Done проекта)

- [ ] Нет импортов из `@/lib/mock`, `store.ts`, `channels.ts` (кроме тестов)
- [ ] Все 32 маршрута загружают данные через React Query + API
- [ ] Загружаемые фото проходят ProcessMedia → WebP + JPEG на CDN
- [ ] UI использует `<picture>` для user-generated content
- [ ] Admin полностью на Admin API
- [ ] Reverb: messenger + moderation + notifications
- [ ] FullDemoSeeder воспроизводит текущий UX
- [ ] CI: backend + frontend + e2e green
- [ ] OpenAPI актуален, Swagger на `/docs/api`

---

## 12. Следующий шаг

**Старт Фазы 0:** PR «API client + Sanctum auth + CORS + api.modelizmclub.ru vhost».

Ответственный выбирает ADR из §10 → параллельно Фаза 1 seed + feed integration.
