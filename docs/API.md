# ModelizmClub API v1

> Базовый URL: `https://dev.modelizmclub.ru/api/v1`  
> Формат: JSON (`Accept: application/json`)  
> Авторизация: Laravel Sanctum — заголовок `Authorization: Bearer {token}`

## Swagger / OpenAPI

| Ресурс | URL |
|--------|-----|
| Интерактивная документация (Scramble) | [https://dev.modelizmclub.ru/docs/api](https://dev.modelizmclub.ru/docs/api) |
| JSON-спецификация (репозиторий) | [openapi/openapi.json](./openapi/openapi.json) |

Обновление спецификации после изменений API:

```bash
bash deploy/scripts/export-openapi.sh
```

---

## Общие соглашения

- Публичные идентификаторы сущностей — **UUID** (поле `uuid` в ответах).
- Числовые `id` пользователей используются только во внутренних маршрутах (`/users/{id}/follow`).
- Ответы списков: `{ data: [...], meta: { current_page, ... }, links: { ... } }`.
- Ошибки валидации: HTTP 422, тело `{ message, errors: { field: ["..."] } }`.
- Rate limits: register 3/min, verify 10/min, login 5/min (по IP/email).

---

## Health

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/health` | — | Статус API и зависимостей |

---

## Auth (`/auth`)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/auth/register` | — | Регистрация |
| POST | `/auth/verify-email` | — | Подтверждение email кодом |
| POST | `/auth/login` | — | Вход → `meta.token` |
| POST | `/auth/forgot-password` | — | Запрос сброса пароля |
| POST | `/auth/reset-password` | — | Сброс пароля |
| GET | `/auth/oauth/{provider}/redirect` | — | OAuth redirect (VK/Yandex) |
| GET | `/auth/oauth/{provider}/callback` | — | OAuth callback |
| POST | `/auth/logout` | ✓ | Выход |
| POST | `/auth/consent` | ✓ | Согласие на обработку ПДн |
| GET | `/auth/me` | ✓ | Текущий пользователь |

---

## Users & Profiles (`/users`)

| Метод | Путь | Auth | CRUD | Описание |
|-------|------|------|------|----------|
| GET | `/users/{slug}` | — | R | Публичный профиль |
| PATCH | `/users/me` | ✓ | U | Обновить профиль |
| GET | `/users/me/settings` | ✓ | R | Настройки уведомлений |
| PATCH | `/users/me/settings` | ✓ | U | Обновить настройки |
| PATCH | `/users/me/privacy` | ✓ | U | Приватность |
| GET | `/users/me/interests` | ✓ | R | Интересы (категории постов) |
| PUT | `/users/me/interests` | ✓ | U | Синхронизация интересов |
| GET | `/users/me/blocks` | ✓ | R | Список блокировок |
| POST | `/users/{id}/follow` | ✓ | C | Подписаться |
| DELETE | `/users/{id}/follow` | ✓ | D | Отписаться |
| POST | `/users/{id}/block` | ✓ | C | Заблокировать |

---

## Catalog

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | `/categories/posts` | — | Дерево категорий постов |
| GET | `/categories/communities` | — | Дерево категорий сообществ |
| GET | `/categories/listings` | — | Деревo категорий объявлений |
| GET | `/cities?q=` | — | Поиск городов |
| GET | `/tags?q=` | — | Поиск тегов |

---

## Communities (`/communities`)

| Метод | Путь | Auth | CRUD | Описание |
|-------|------|------|------|----------|
| GET | `/communities` | — | R | Список сообществ |
| GET | `/communities/{slug}` | — | R | Карточка сообщества |
| GET | `/communities/{slug}/members` | — | R | Участники |
| GET | `/communities/{slug}/posts` | — | R | Посты сообщества |
| POST | `/communities/apply` | ✓ | C | Заявка на создание |
| POST | `/communities/{slug}/join` | ✓ | C | Вступить |
| DELETE | `/communities/{slug}/leave` | ✓ | D | Выйти |

---

## Feed & Posts

| Метод | Путь | Auth | CRUD | Описание |
|-------|------|------|------|----------|
| GET | `/feed` | —* | R | Лента (`filter=all\|following\|category`) |
| POST | `/posts` | ✓ | C | Создать черновик |
| GET | `/posts/{uuid}` | —* | R | Просмотр поста |
| PATCH | `/posts/{uuid}` | ✓ | U | Редактировать черновик |
| DELETE | `/posts/{uuid}` | ✓ | D | Удалить |
| POST | `/posts/{uuid}/publish` | ✓ | — | Отправить на модерацию |
| POST | `/posts/{uuid}/react` | ✓ | C | Реакция (`type=like`) |
| DELETE | `/posts/{uuid}/react` | ✓ | D | Убрать реакцию |
| POST | `/posts/{uuid}/bookmark` | ✓ | C | В закладки |
| DELETE | `/posts/{uuid}/bookmark` | ✓ | D | Из закладок |
| POST | `/posts/{uuid}/repost` | ✓ | C | Репост |
| GET | `/posts/{uuid}/comments` | — | R | Комментарии (корневые) |
| POST | `/posts/{uuid}/comments` | ✓ | C | Добавить комментарий |
| GET | `/comments/{uuid}/thread` | — | R | Вся ветка обсуждения |

\* Черновики и посты на модерации видны только автору (и модераторам).

### Жизненный цикл поста

```
draft → (publish) → pending_moderation → (moderator) → published | rejected
```

На dev-сервере `FEED_AUTO_PUBLISH=true` — после publish пост сразу `published`.

### Пример создания поста

```http
POST /api/v1/posts
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Сборка P-51",
  "body": "Прогресс за неделю…",
  "category_id": 1,
  "hashtags": ["p51", "scale72"]
}
```

---

## Media (`/media`)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/media/upload-session` | ✓ | Presigned URL для S3 |
| POST | `/media/confirm` | ✓ | Подтверждение загрузки |

Поток: `upload-session` → загрузка в S3 → `confirm` → прикрепление `media_ids` к посту.

---

## Admin & Moderation (`/admin`)

> Требуется Bearer-токен. Moderation — роль `moderator` или `admin`; остальное — только `admin`.

### Moderation (moderator+)

| Метод | Путь | CRUD | Описание |
|-------|------|------|----------|
| GET | `/admin/moderation/queue` | R | Очередь (`?status=pending&queue=posts`) |
| POST | `/admin/moderation/{type}/{id}/approve` | U | Одобрить (`type`: `posts`, `communities`) |
| POST | `/admin/moderation/{type}/{id}/reject` | U | Отклонить (`reason` в body) |
| POST | `/admin/moderation/{type}/{id}/revision` | U | На доработку (`comment` в body) |
| GET | `/admin/reports` | R | Жалобы пользователей |

### Admin (admin only)

| Метод | Путь | CRUD | Описание |
|-------|------|------|----------|
| GET | `/admin/dashboard` | R | Сводка (users, moderation, reports…) |
| GET/POST | `/admin/users` | R/C | Список / создать пользователя |
| GET/PATCH/DELETE | `/admin/users/{uuid}` | R/U/D | Карточка пользователя |
| GET/POST | `/admin/categories/post` | R/C | Категории постов |
| GET/PATCH/DELETE | `/admin/categories/post/{id}` | R/U/D | |
| GET/POST | `/admin/categories/community` | R/C | Категории сообществ |
| GET/PATCH/DELETE | `/admin/categories/listing` | R/C/U/D | Категории объявлений |
| GET/POST | `/admin/communities` | R/C | Сообщества |
| GET/PATCH/DELETE | `/admin/communities/{slug}` | R/U/D | |
| GET/POST | `/admin/plans` | R/C | Тарифы подписки |
| GET/PATCH/DELETE | `/admin/plans/{slug}` | R/U/D | |
| GET/POST | `/admin/promocodes` | R/C | Промокоды |
| GET/PATCH/DELETE | `/admin/promocodes/{code}` | R/U/D | |
| GET/POST | `/admin/banners` | R/C | Рекламные баннеры |
| GET/PATCH/DELETE | `/admin/banners/{id}` | R/U/D | |
| GET | `/admin/audit-logs` | R | Журнал действий |
| GET/PATCH | `/admin/settings` | R/U | Системные настройки |

---

## Тестовые аккаунты (dev)

| Email | Пароль | Роль | Назначение |
|-------|--------|------|------------|
| `demo@modelizmclub.ru` | `password123` | user | Посты, профиль, сообщества |
| `moderator@modelizmclub.ru` | `password123` | moderator | Модерация, reports |
| `admin@modelizmclub.ru` | `password123` | admin | Admin CRUD, dashboard |

В Swagger: **Authorize** → `Bearer {token}` после `POST /auth/login`.

---

## Переменные окружения (API)

| Переменная | Описание |
|------------|----------|
| `FEED_AUTO_PUBLISH` | `true` на dev — автопубликация после модерации |
| `FEED_MAX_COMMENT_DEPTH` | Макс. глубина вложенности комментариев (по умолчанию 5) |
| `API_VERSION` | Версия в OpenAPI |

---

## Smoke-скрипты

```bash
bash deploy/scripts/smoke-auth.sh
bash deploy/scripts/smoke-users.sh
bash deploy/scripts/smoke-catalog.sh
bash deploy/scripts/smoke-feed.sh
bash deploy/scripts/verify-api-crud.sh   # полный CRUD-проход (user + admin)
```

---

## Статус реализации (Этап 1)

| Модуль | Статус |
|--------|--------|
| Auth + Users | ✅ |
| Catalog | ✅ |
| Communities | ✅ |
| Feed (Posts, Comments) | ✅ |
| Media upload | ✅ |
| Admin + Moderation API | ✅ |
| Listings, Chat, Billing | 🔜 Sprint 5+ |
| Public landing API | 🔜 Sprint 4+ |

Подробный план схемы БД: [PLAN-DB-API.md](./PLAN-DB-API.md).
