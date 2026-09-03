# Backend ModelizmClub — руководство для клиента

Документ описывает **весь** HTTP API бэкенда, таблицы базы данных, роли и доступы, платёжный контур ВТБ и безопасную сделку. Составлен по коду репозитория и по **реальному** прогону PHPUnit на прод-сервере 3 сентября 2026.

| | |
|---|---|
| Базовый URL API | `https://api.modelizmclub.ru/api/v1` (также `https://modelizmclub.ru/api/v1`) |
| Интерактивный Swagger | [https://api.modelizmclub.ru/docs/api](https://api.modelizmclub.ru/docs/api) |
| Формат | JSON, заголовок `Accept: application/json` |
| Авторизация | Laravel Sanctum: `Authorization: Bearer {token}` |
| Версия кода на сервере на момент тестов | `4dd1901` — `feat(feed): nest comment threads, attach photos, and share posts like VK` |
| Число маршрутов `/api/v1` | **432** (включая HEAD-дубликаты Laravel) |

Краткий указатель: [как вызывать](#1-как-вызывать-api) · [роли](#2-пользователи-роли-доступы) · [зоны и роуты](#3-зоны-ответственности-и-все-роуты) · [таблицы](#4-таблицы-базы-данных) · [ВТБ и безопасная сделка](#5-платёжная-система-втб-и-безопасная-сделка) · [что ещё нужно для сделки](#6-что-необходимо-для-полноценной-работы-безопасной-сделки) · [тесты](#7-тесты-на-сервере-реальные-факты).

---

## 1. Как вызывать API

### 1.1. Запрос

```http
POST /api/v1/auth/login HTTP/1.1
Host: api.modelizmclub.ru
Accept: application/json
Content-Type: application/json

{"email":"user@example.com","password":"..."}
```

Токен приходит в `meta.token` (логин) или в ответе регистрации после верификации. Дальше:

```http
GET /api/v1/auth/me HTTP/1.1
Authorization: Bearer 1|xxxxxxxx
Accept: application/json
```

Публичные идентификаторы сущностей — **UUID** (`data.uuid`). Числовой `{id}` используется только там, где это указано (подписка/блок пользователя, заявки в друзья, часть админки).

### 1.2. Ответы и ошибки

| HTTP | Когда |
|------|--------|
| 200 / 201 | Успех. Списки: `{ data, meta, links }` (Laravel paginator). Карточка: `{ data: { ... } }` |
| 401 | Нет токена или сессия недействительна |
| 403 | Недостаточно прав. Часто с `code`: `email_not_verified`, `phone_not_verified`, `subscription_required` |
| 404 | Нет сущности или фича выключена (сообщества → 404 «Сообщества отключены») |
| 422 | Валидация: `{ message, errors: { field: ["…"] } }` |
| 429 | Rate limit (регистрация 3/мин, логин 5/мин, verify 10/мин, SMS — отдельные лимиты) |
| 503 | Health: БД или кэш недоступны |

### 1.3. Уровни доступа на роуте (колонка «Доступ»)

| Метка | Middleware | Кто |
|-------|------------|-----|
| Публичный | нет | Гость |
| Bearer | `auth:sanctum` | Любой вошедший (в т.ч. без подтверждённого телефона) |
| Verified | `auth:sanctum` + `verified` | Email **и** телефон подтверждены. Модератор и админ **обходят** проверку |
| Subscription | + `requiresSubscription` | Активная подписка. Модератор и админ обходят |
| optionalAuth | токен не обязателен | Гость видит контент; если токен есть — в ответе свои лайки |
| Mod | `role:moderator,admin` | Модератор или админ |
| Admin | `role:admin` | Только админ |
| Webhook | без auth | Банк / СДЭК / MAX. Подписи HMAC **нет** |

`verified` = email подтверждён **или** пользователь вошёл через VK/MAX (email не требуют) **и** `phone_verified_at` заполнен.

### 1.4. Пагинация

Параметр `per_page`. Типичный максимум **50** (лента, объявления, сообщества, сделки). Видео и часть админки — до **100**.

### 1.5. Feature flags

`GET /public/feature-flags` и блок в `GET /public/bootstrap`:

| Ключ | Назначение |
|------|------------|
| `communities_enabled` | Если выключен — все `/communities/*` отдают 404 |
| `reviews_enabled` | Раздел видео-обзоров на фронте |
| `market_enabled` | Каталог объявлений на фронте |
| `escrow_enabled` | Кнопка «безопасная сделка» на **фронте**. Бэкенд API сделки **не проверяет** этот флаг |
| `listing_payment_enabled` | Платное размещение объявления |

---

## 2. Пользователи, роли, доступы

### 2.1. Модель пользователя

Две системы рядом:

1. Колонка `users.role` — **реальный ACL** (`user` / `subscriber` / `moderator` / `admin`).
2. Таблицы Spatie (`roles`, `permissions`, …) сидируются, **permissions не используются** в middleware.

Подписка — не роль, а факт: есть активная строка в `user_subscriptions` **и** (оплаченный платёж **или** место в акции «первые N»). Роль `subscriber` в enum есть, но доступ к видео-публикации проверяется через `hasActiveSubscription()`, не через имя роли.

### 2.2. Статусы аккаунта (`users.status`)

| Статус | Смысл |
|--------|--------|
| `pending_verification` | Зарегистрирован, вход закрыт до подтверждения email (кроме OAuth VK/MAX) |
| `active` | Может войти |
| `blocked` | Заблокирован администратором |
| `deleted` | Soft-delete / удаление по 152-ФЗ |

Телефон **не** является статусом: это поле `phone_verified_at`.

### 2.3. Трек регистрации (`registration_track`)

Обязателен при `POST /auth/register`: `community` | `listing` | `social`. Влияет на онбординг на фронте, не на ACL.

### 2.4. Матрица доступа

| Возможность | Гость | Вошёл | Verified | Подписка | Модератор | Админ |
|-------------|:-----:|:-----:|:--------:|:--------:|:---------:|:-----:|
| Читать ленту, объявления, профили, видео, FAQ, legal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Логин, кошелёк, список сделок, чат (чтение) | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Посты, комментарии, объявления, чат (отправка), звонки, сообщества | | | ✓ | ✓ | ✓ | ✓ |
| Публиковать / лайкать / комментировать **видео-обзоры** | | | | ✓ | ✓ | ✓ |
| Очередь модерации, жалобы, заявки сообществ/каналов | | | | | ✓ | ✓ |
| Платежи, кошельки, сделки, споры, настройки сайта, пользователи | | | | | | ✓ |

Гостевой доступ к **кнопкам** ленты (написать, лайк, репост) дополнительно режется настройкой `GET /public/feed-guest-access` — это UI, не замена middleware.

Модератор **не** видит `/admin/payments`, `/admin/wallets`, `/admin/safe-deals` — только админ.

### 2.5. Что нужно пользователю для «полной» работы площадки

1. Регистрация → код на email (`POST /auth/verify-email`).
2. SMS на телефон (`POST /account/phone/send-code` + `verify`).
3. Согласия (`accept_terms`, `accept_privacy` при регистрации; `POST /auth/consent` при обновлении документов).
4. Для видео-обзоров — оплаченная подписка (`POST /payments` с `plan_slug`) или место в промо-пуле.
5. Для продажи через безопасную сделку — реквизиты СБП (`PUT /account/payout-requisites`) и профиль отправки СДЭК (`POST /users/me/delivery-profile`).
6. Для платного размещения объявления — флаг `listing_payment_enabled` + `POST /payments` с `payable_type=listing_placement` либо кредит размещения.

---

## 3. Зоны ответственности и все роуты

Префикс везде `/api/v1`. Ниже — полный каталог по модулям.

---

### 3.1. Служебное

| Метод | Путь | Доступ | Для чего | Как использовать |
|-------|------|--------|----------|------------------|
| GET | `/health` | Публичный | Жив ли API, БД и кэш | Мониторинг. `{ data.status: ok\|degraded }` |
| GET | `/up` | Публичный | Laravel health (вне префикса v1) | Инфраструктурная проверка |

---

### 3.2. Auth — вход, регистрация, OAuth, MAX

**Таблицы:** `users`, `email_verification_codes`, `password_reset_tokens`, `personal_access_tokens`, `sessions`, `user_oauth_accounts`, `personal_data_consents`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| POST | `/auth/register` | Публичный, throttle | Создать аккаунт |
| POST | `/auth/verify-email` | Публичный, throttle | Подтвердить email 6-значным кодом |
| POST | `/auth/login` | Публичный, throttle | Войти, получить Bearer |
| POST | `/auth/forgot-password` | Публичный | Письмо со ссылкой сброса |
| POST | `/auth/reset-password` | Публичный | Новый пароль по токену |
| GET | `/auth/oauth/{provider}/redirect` | Публичный | Старт VK / Yandex |
| GET | `/auth/oauth/{provider}/callback` | Публичный | Возврат OAuth |
| POST | `/auth/oauth/max/start` | Публичный | Старт входа через MAX |
| GET | `/auth/oauth/max/status` | Публичный | Статус сессии MAX (`?session=`) |
| POST | `/auth/logout` | Bearer | Выйти из текущего токена |
| POST | `/auth/logout-others` | Bearer | Сбросить остальные сессии |
| POST | `/auth/consent` | Bearer | Зафиксировать согласие на ПДн |
| GET | `/auth/me` | Bearer | Текущий пользователь |
| POST | `/auth/oauth/max/link` | Bearer | Привязать MAX к аккаунту |
| DELETE | `/auth/oauth/max` | Bearer | Отвязать MAX |
| POST | `/webhooks/max` | Webhook | Входящие события MAX |

**`POST /auth/register`**

| Поле | Правила |
|------|---------|
| `email` | required, email |
| `password` | required, min 8, + `password_confirmation` |
| `registration_track` | `community` \| `listing` \| `social` |
| `display_name` | 2–120, буквы/пробел/дефис/апостроф |
| `phone` | необязательно, max 20 |
| `referral_code` | необязательно, max 40 |
| `accept_terms` | must be accepted |
| `accept_privacy` | must be accepted |
| `accept_ads` | необязательно, boolean |

**`POST /auth/login`:** `email`, `password`.  
**`POST /auth/verify-email`:** `email`, `code` (ровно 6).  
**`POST /auth/forgot-password`:** `email`.  
**`POST /auth/reset-password`:** `token`, `email`, `password`, `password_confirmation`.  
**`POST /auth/consent`:** `document_version`.

Типичный сценарий: register → письмо с кодом → verify-email → login → send-code телефона → verify телефона → дальше Verified-роуты.

---

### 3.3. Account — пароль, email, телефон, 2FA, реквизиты, карты

**Таблицы:** `pending_email_changes`, `phone_verification_codes`, `user_two_factor`, `user_document_requisites`, `user_payout_requisites`, `saved_payment_methods`, `user_view_history`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| POST | `/account/change-password` | Bearer | Сменить пароль (`current_password`, `new_password`) |
| POST | `/account/change-email` | Bearer | Запросить смену email (`new_email`) |
| POST | `/account/email` | Bearer | То же (алиас) |
| POST | `/account/confirm-email` | Bearer | Подтвердить новый email (`code`) |
| POST | `/account/resend-verification-email` | Bearer | Повтор письма первичной верификации |
| POST | `/account/email/verify/resend` | Bearer | Повтор кода смены email |
| POST | `/account/phone/send-code` | Bearer, throttle | SMS-код (`phone`) |
| POST | `/account/phone/verify` | Bearer, throttle | Подтвердить телефон (`phone`, `code`) |
| GET | `/account/requisites` | Bearer | Юр. реквизиты (ФИО, ИНН, адрес) |
| PUT | `/account/requisites` | Verified | Сохранить: `full_name?`, `inn?`, `phone?`, `address?` |
| GET | `/account/payment-methods` | Bearer | Сохранённые карты |
| POST | `/account/payment-methods` | Verified | Начать привязку карты |
| DELETE | `/account/payment-methods/{id}` | Verified | Удалить карту (UUID) |
| GET | `/account/payment-methods/bind/complete` | Публичный | Возврат с формы привязки |
| GET | `/account/payout-requisites` | Bearer | Реквизиты выплат продавцу |
| PUT | `/account/payout-requisites` | Verified | Сохранить (карта / СБП — см. кабинет продавца) |
| POST | `/account/2fa/setup` | Verified | Начать TOTP |
| POST | `/account/2fa/verify` | Verified | Включить 2FA (`code`) |
| POST | `/account/2fa/disable` | Verified | Выключить 2FA (`code`) |
| GET | `/me/view-history` | Bearer | История просмотров (`per_page` ≤ 100) |
| POST | `/me/view-history` | Bearer | Записать: `id`, `kind` (`ad`\|`profile`\|`review`), `title?`, `thumb?` |
| DELETE | `/me/view-history` | Bearer | Очистить |
| GET | `/me/entity-requests` | Bearer | Мои заявки на сообщество/канал |

---

### 3.4. User — профиль, друзья, подписки, уведомления, отзывы, рефералы

**Таблицы:** `user_profiles`, `user_follows`, `user_blocks`, `user_friendships`, `friend_requests`, `user_interests`, `notifications`, `notification_preferences`, `user_reviews`, `referrals`, `feedback`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/users/search` | Bearer | Поиск: `q`, `city_id`, `interest`/`category_id`, `sort`=`newest\|name\|popular\|rating`, `per_page`≤50 |
| GET | `/users/{slug}` | Публичный | Публичный профиль |
| GET | `/users/{id}/rating` | Публичный | Рейтинг продавца |
| GET | `/users/{id}/reviews` | Публичный | Отзывы |
| PATCH | `/users/me` | Verified | Профиль: `display_name`, `slug`, `bio`, `city_id`, соцссылки, `phone`, `avatar_media_uuid`, `cover_media_uuid` |
| GET | `/users/me/settings` | Bearer | Настройки уведомлений |
| PATCH | `/users/me/settings` | Bearer | `preferences[]`: `{channel, type, enabled}` |
| PATCH | `/users/me/privacy` | Verified | `profile_visibility`=`public\|registered\|followers`, `show_email`, `show_activity` |
| GET | `/users/me/interests` | Bearer | Интересы (категории постов) |
| PUT | `/users/me/interests` | Verified | `category_ids[]` (max 10) |
| GET | `/users/me/stats` | Bearer | Счётчики кабинета |
| GET | `/users/me/stats/views-daily` | Bearer | Просмотры объявлений по дням |
| POST | `/users/me/presence` | Bearer | Heartbeat «онлайн» |
| GET | `/users/me/referrals` | Bearer | Реферальный кабинет |
| POST | `/users/me/referrals/claim` | Bearer | Применить код: `code` |
| GET | `/users/me/notifications` | Bearer | Лента уведомлений |
| GET | `/users/me/notifications/unread-count` | Bearer | Счётчик непрочитанных |
| POST | `/users/me/notifications/read-all` | Verified | Прочитать все |
| POST | `/users/me/notifications/{id}/read` | Verified | Прочитать одно |
| DELETE | `/users/me/notifications` | Verified | Удалить все |
| DELETE | `/users/me/notifications/{id}` | Verified | Удалить одно |
| GET | `/users/me/blocks` | Bearer | Кого заблокировал |
| POST | `/users/{id}/block` | Verified | Заблокировать (`reason?`) |
| DELETE | `/users/{id}/block` | Verified | Разблокировать |
| POST | `/users/{id}/follow` | Verified | Подписаться |
| DELETE | `/users/{id}/follow` | Verified | Отписаться |
| GET | `/users/me/friends` | Bearer | Друзья |
| GET | `/users/me/friend-requests` | Bearer | Входящие заявки |
| GET | `/users/me/friend-requests/sent` | Bearer | Исходящие |
| POST | `/users/{id}/friend-request` | Verified | Отправить заявку |
| POST | `/friend-requests/{id}/accept` | Verified | Принять |
| POST | `/friend-requests/{id}/decline` | Verified | Отклонить |
| DELETE | `/friend-requests/{id}` | Verified | Отменить исходящую |
| DELETE | `/users/me/friends/{id}` | Verified | Удалить из друзей |
| POST | `/users/me/reviews/{uuid}/reply` | Bearer | Ответ на отзыв: `reply` max 2000 |
| POST | `/feedback` | Публичный | Обратная связь: `message` обязателен; гостю нужен `guest_email`; `subject?`, `page?` |

`{id}` в follow/block/friends — **числовой** id пользователя, не UUID и не slug.

---

### 3.5. Catalog — справочники

**Таблицы:** `post_categories`, `community_categories`, `listing_categories`, `cities`, `tags`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/categories/posts` | Публичный | Дерево категорий ленты |
| GET | `/categories/communities` | Публичный | Дерево категорий сообществ |
| GET | `/categories/listings` | Публичный | Дерево категорий объявлений |
| GET | `/cities` | Публичный | Поиск городов `?q=` |
| GET | `/tags` | Публичный | Поиск тегов `?q=` |
| GET | `/geo/address-suggest` | Публичный, 30/мин | Подсказки адреса |

---

### 3.6. Feed — лента, посты, комментарии, репосты

**Таблицы:** `posts`, `post_media`, `post_hashtags`, `post_reactions`, `post_bookmarks`, `post_reposts`, `comments`, `comment_reactions`, `comment_media`, `community_pinned_posts`.

Жизненный цикл поста: `draft` → `publish` → `pending_moderation` → `published` \| `rejected`. На проде автопубликация зависит от `FEED_AUTO_PUBLISH` и настроек модерации.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/feed` | Публичный | Лента |
| POST | `/posts` | Verified | Создать черновик/пост |
| GET | `/posts/{uuid}` | Публичный* | Карточка поста |
| PATCH | `/posts/{uuid}` | Verified | Редактировать (автор) |
| DELETE | `/posts/{uuid}` | Verified | Удалить |
| POST | `/posts/{uuid}/publish` | Verified | На модерацию / публикацию |
| POST | `/posts/{uuid}/schedule` | Verified | Отложенная публикация |
| DELETE | `/posts/{uuid}/schedule` | Verified | Снять расписание |
| POST | `/posts/{uuid}/react` | Verified | Лайк (`type` по умолчанию `like`) |
| DELETE | `/posts/{uuid}/react` | Verified | Убрать лайк |
| POST | `/posts/{uuid}/bookmark` | Verified | В закладки |
| DELETE | `/posts/{uuid}/bookmark` | Verified | Из закладок |
| POST | `/posts/{uuid}/repost` | Verified | Репост VK-стиля, опционально `body` |
| DELETE | `/posts/{uuid}/repost` | Verified | Снять свой репост |
| GET | `/posts/{uuid}/comments` | Публичный | Корневые комментарии + вложенные `replies` |
| POST | `/posts/{uuid}/comments` | Verified | Комментарий / ответ |
| GET | `/comments/{uuid}/thread` | Публичный | Вся ветка |
| DELETE | `/comments/{uuid}` | Verified | Удалить свой (или модератор); корень каскадом |
| POST | `/comments/{uuid}/react` | Verified | Лайк комментария |
| DELETE | `/comments/{uuid}/react` | Verified | Убрать лайк |

\* Черновики и посты на модерации видит автор и модерация.

**Фильтры `GET /feed`:** `filter` (`all` по умолчанию, также `following`, категория), `category_id`, `taxonomy_id`, `community_id`, `author_id`, `q`, `hashtag`, `has_media`, `date_from`, `date_to`, `sort`=`new` (деф.) \| `popular` \| `discussed` \| `viewed` \| `oldest`, `per_page`≤50.

**`POST /posts`:** `title` (max 100), `body` (max 10000), `category_id` (обязателен), `community_id?`, `subcategory_id?`, `media_ids[]` max 10 UUID, `hashtags[]` max 30.

**`POST /posts/{uuid}/comments`:** `body?` max 5000, `parent_uuid?` (ответ на любой уровень), `media_ids[]` max 4. Нужен **текст или фото**.

**`POST /posts/{uuid}/schedule`:** `scheduled_at` ISO **или** `scheduled_at_local` + `timezone`.

**Комментарии `GET`:** `sort`=`interesting\|old\|new`, `per_page`≤100.

Сценарий публикации с видео: `POST /media/upload-session` (purpose `post_video`) → PUT в S3 → `POST /media/confirm` → `POST /posts` с `media_ids` → `publish`. Пока файл не готов, в карточке статус обработки.

---

### 3.7. Media — загрузка файлов

**Таблицы:** `media`, `media_attachments`, `upload_sessions`, `media_transcripts`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| POST | `/media` | Verified | Прямая загрузка multipart: `purpose`, `file`, `duration?` |
| POST | `/media/upload-session` | Verified | Сессия presigned PUT: `purpose`, `files[]` `{name,size,mime}` |
| POST | `/media/confirm` | Verified | Подтвердить загрузку: `session_uuid`, `media_uuids[]` |
| POST | `/media/fail` | Verified | Пометить сбой: `media_uuids[]` |
| POST | `/media/{uuid}/transcribe` | Verified | Расшифровка голосового |
| GET | `/media/{uuid}` | Публичный | Отдать оригинал (прокси с приватного бакета) |
| GET | `/media/{uuid}/{variant}` | Публичный | Вариант: `thumb.webp`, `card.jpg`, `large.webp` и т.д. |

`purpose`: `avatar`, `post`, `post_video`, `comment`, `listing`, `banner`, `cover`, `review_video`, `chat`, `voice`, `icon`, `logo`, `dispute`.

Клиент **не** ходит в S3 напрямую без сессии: сначала upload-session, затем PUT по выданному URL, затем confirm. UUID из confirm вставляется в пост/объявление/комментарий.

---

### 3.8. Listing — каталог объявлений

**Таблицы:** `listings`, `listing_media`, `listing_favorites`, `listing_status_logs`, `listing_promotions`, `listing_pricing_rules`, `listing_view_daily`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/listings` | Публичный | Каталог |
| GET | `/listings/boost-packages` | Публичный | Пакеты продвижения |
| GET | `/listings/{uuid}` | Публичный | Карточка |
| GET | `/listings/placement-quote` | Verified | Цена размещения: `taxonomy_id?`, `category_id?`, `promocode?` |
| POST | `/listings` | Verified | Создать |
| POST | `/listings/ai-suggest` | Verified | Подсказка категории/текста: `title?`, `description?`, `hints[]` |
| PATCH | `/listings/{uuid}` | Verified | Редактировать своё |
| DELETE | `/listings/{uuid}` | Verified | Soft-delete |
| POST | `/listings/{uuid}/restore` | Verified | Восстановить |
| POST | `/listings/{uuid}/publish` | Verified | Опубликовать / на модерацию |
| POST | `/listings/{uuid}/archive` | Verified | В архив |
| POST | `/listings/{uuid}/promote` | Verified | Продвижение: `package`, `idempotency_key?` |
| POST | `/listings/{uuid}/reveal-phone` | Verified | Показать телефон продавца |
| POST | `/listings/{uuid}/favorite` | Verified | В избранное |
| DELETE | `/listings/{uuid}/favorite` | Verified | Из избранного |
| GET | `/users/me/listings` | Bearer | Мои объявления: `status`, `q`, `sort`, `per_page`≤50 |
| GET | `/users/me/favorites` | Bearer | Избранное |
| GET | `/users/me/pickup-addresses` | Bearer | Недавние адреса самовывоза |
| GET | `/users/{slug}/listings` | Публичный | Объявления пользователя |

**Фильтры каталога:** `category_id`, `subcategory_id`, `category_ids[]`, `taxonomy_id`, `city_id`, `q`, `price_min`/`price_max` (₽), `delivery_method`, `has_media`, `sort`=`newest\|oldest\|price_asc\|price_desc\|popular\|favorites`.

**Создание (`POST /listings`):**

| Поле | Правила |
|------|---------|
| `title` | required, max 255 |
| `description` | required, max 10000 |
| `category_id` | обязателен, если нет `taxonomy_id` |
| `taxonomy_id` | id из `post_categories` (единая таксономия) |
| `subcategory_id` | необязательно |
| `price_cents` | копейки, 0…99_999_999_900 (макс. 999 999 999 ₽) |
| `city_id` | город |
| `delivery_methods[]` | активные имена из справочника (`pickup`, `cdek`, …) |
| `package_size` | `s` \| `m` \| `l` |
| `weight_kg` | 0.01–100 |
| `dimensions_cm.{length,width,height}` | 1–200 см |
| `pickup_address` | для самовывоза |
| `media_ids[]` | UUID фото |
| `publish` | сразу отправить на публикацию |
| `promocode` | код скидки размещения |
| `placement_payment_uuid` | UUID уже оплаченного размещения |

Если включён `listing_payment_enabled`, публикация требует оплату или кредит размещения.

---

### 3.9. Billing — подписки, платежи, кошелёк

Подробности VTB и сделки — [глава 5](#5-платёжная-система-втб-и-безопасная-сделка). Здесь полный список роутов зоны.

**Таблицы:** `subscription_plans`, `user_subscriptions`, `payments`, `payment_items`, `promocodes`, `promocode_usages`, `bonus_accounts`, `bonus_transactions`, `wallets`, `wallet_transactions`, `withdrawal_requests`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/plans` | Публичный | Тарифы подписки |
| GET | `/users/me/subscription` | Bearer | Моя подписка |
| POST | `/users/me/subscription/cancel` | Bearer | Отключить автопродление |
| POST | `/payments` | Bearer | Создать платёж (подписка / размещение) |
| GET | `/payments/{uuid}` | Bearer | Статус платежа |
| POST | `/payments/{uuid}/sync` | Bearer | Переспросить банк |
| POST | `/payments/{uuid}/confirm-stub` | Bearer | Тестовая оплата (только stub, не live VTB) |
| GET\|POST | `/payments/webhooks/vtb` | Webhook | Callback эквайринга по подпискам/топапу |
| GET | `/wallet` | Bearer | Баланс и холд |
| GET | `/wallet/transactions` | Bearer | История (`per_page`≤100) |
| POST | `/wallet/topup` | Bearer | Пополнить: `amount` 100–1 000 000 ₽, `return_url?`, `idempotency_key?` |
| POST | `/wallet/withdraw` | Bearer | Заявка на вывод: `amount`, `method`=`card\|sbp\|account`, `destination` |

**`POST /payments`:**

| Поле | Правила |
|------|---------|
| `plan_slug` | тариф, обязателен если нет `payable_type` |
| `payable_type` | `listing_placement` — оплата размещения |
| `taxonomy_id` / `category_id` / `subcategory_id` | для цены размещения |
| `promocode` | скидка |
| `listing_uuid` | привязка к объявлению |
| `pay_with` | `gateway` (ВТБ/stub) или `wallet` |
| `idempotency_key` | защита от двойного клика |

Ответ: `payment_uuid`, `checkout_url` (форма банка или `/pay/stub/{uuid}`), `status`, `provider`.

Клиент: создать платёж → открыть `checkout_url` → после возврата `GET /payments/{uuid}` или `POST …/sync`. Не считать оплату успешной по одному редиректу — источник истины банк / webhook.

---

### 3.10. Безопасная сделка (пользовательские роуты)

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| POST | `/listings/{uuid}/safe-deal/quote` | Bearer | Расчёт сумм до оплаты |
| POST | `/listings/{uuid}/safe-deal` | Bearer | Создать сделку (покупатель) |
| GET | `/safe-deals` | Bearer | Мои сделки: `role=buyer\|seller`, `per_page`≤50 |
| GET | `/safe-deals/{uuid}` | Bearer | Карточка (участник или модератор) |
| POST | `/safe-deals/{uuid}/ship` | Bearer | Продавец: отправлено |
| POST | `/safe-deals/{uuid}/delivered` | Bearer | Доставлено |
| POST | `/safe-deals/{uuid}/confirm` | Bearer | Покупатель: подтвердить получение |
| POST | `/safe-deals/{uuid}/cancel` | Bearer | Отмена + возврат |
| POST | `/safe-deals/{uuid}/dispute` | Bearer | Открыть спор |
| POST | `/safe-deals/{uuid}/review` | Bearer | Отзыв после `completed` |
| GET\|POST | `/safe-deals/webhooks/vtb` | Webhook | Оплата/холд по сделке |
| POST | `/safe-deals/webhooks/vtb-payout` | Webhook | Статус выплаты СБП |
| POST | `/safe-deals/webhooks/delivery` | Webhook | Статус доставки |

Параметры quote/create и статусы — в [главе 5](#5-платёжная-система-втб-и-безопасная-сделка).

---

### 3.11. Community — сообщества

Все пути за флагом `feature.communities_enabled`.

**Таблицы:** `communities`, `community_members`, `community_applications`, `community_join_requests`, `community_events`, `community_event_attendees`, `community_topic_categories`, `community_subcategories`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/communities` | Публичный | Список: `q`, `category_id`, `official`, `owned`, `sort`, `per_page`≤50 |
| GET | `/communities/{slug}` | Публичный | Карточка |
| GET | `/communities/{slug}/members` | Публичный | Участники |
| GET | `/communities/{slug}/posts` | Публичный | Посты сообщества |
| GET | `/communities/{slug}/events` | Публичный | События |
| POST | `/communities/apply` | Verified | Заявка на создание |
| POST | `/communities/{slug}/join` | Verified | Вступить (или заявка, если закрытое) |
| DELETE | `/communities/{slug}/leave` | Verified | Выйти |
| GET | `/communities/{slug}/chat` | Verified | Чат сообщества |
| POST | `/communities/{slug}/events` | Verified | Создать событие (организатор) |
| POST | `/communities/{slug}/events/{uuid}/attend` | Verified | RSVP |
| GET | `/communities/{slug}/join-requests` | Verified | Заявки (админ сообщества) |
| POST | `/communities/{slug}/join-requests/{id}/approve` | Verified | Одобрить |
| POST | `/communities/{slug}/join-requests/{id}/reject` | Verified | Отклонить |
| DELETE | `/communities/{slug}/members/{userUuid}` | Verified | Исключить |
| PATCH | `/communities/{slug}/branding` | Verified | `avatar_media_uuid`, `cover_media_uuid` |
| PATCH | `/communities/{slug}` | Verified | Название, правила, `access_type`=`open\|request`, контакты |
| DELETE | `/communities/{slug}` | Verified | Удалить: body `confirm_name` |

**`POST /communities/apply`:** `proposed_name`, `description?`, `category_id?`, `city_id?`, `post_category_ids[]`, `custom_category?`, `rules?`, `access_type?`, `contacts.{telegram,website,phone}?`, `avatar_media_uuid?`, `cover_media_uuid?`.

---

### 3.12. Channel — каналы (broadcast)

**Таблицы:** `channels`, `channel_subscriptions`, `channel_posts`, `channel_post_media`, `channel_post_likes`, `channel_post_views`, `channel_admins`, `channel_applications`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/channels` | Публичный | Список, фильтр `taxonomy_id` |
| GET | `/channels/{slug}` | Публичный | Карточка |
| GET | `/channels/{slug}/posts` | Публичный | Посты канала |
| POST | `/channels/{slug}/posts/{postUuid}/view` | Публичный | Учесть просмотр |
| POST | `/channels/apply` | Verified | Заявка: `name`, `slug?`, `description?`, `kind?`=`brand\|shop\|author\|expert`, `comments_enabled?`, медиа |
| POST | `/channels/{slug}/subscribe` | Verified | Подписаться |
| DELETE | `/channels/{slug}/subscribe` | Verified | Отписаться |
| PATCH | `/channels/{slug}` | Verified | Владелец: имя, правила, контакты |
| PATCH | `/channels/{slug}/branding` | Verified | Аватар / баннер |
| POST | `/channels/{slug}/posts` | Verified | Пост: `text`, `kind?`=`news\|review\|announce\|promo`, `media_ids[]` max 10 |
| POST | `/channels/{slug}/posts/{postUuid}/like` | Verified | Лайк |
| DELETE | `/channels/{slug}/posts/{postUuid}/like` | Verified | Убрать лайк |
| POST | `/channels/{slug}/posts/{postUuid}/pin` | Verified | Закрепить |
| DELETE | `/channels/{slug}/posts/{postUuid}/pin` | Verified | Открепить |
| DELETE | `/channels/{slug}/posts/{postUuid}` | Verified | Удалить пост |
| DELETE | `/channels/{slug}` | Verified | Удалить канал: `confirm_name` |

---

### 3.13. Chat — сообщения и комнаты категорий

**Таблицы:** `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_read_receipts`, `message_user_hides`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/conversations` | Bearer | Список диалогов: `space`=`chats\|communities\|rooms` |
| POST | `/conversations` | Verified | Начать диалог: `user_id`, `listing_uuid?` |
| GET | `/conversations/{uuid}` | Bearer | Карточка диалога |
| DELETE | `/conversations/{uuid}` | Verified | Скрыть/удалить у себя |
| GET | `/conversations/{uuid}/messages` | Bearer | Сообщения |
| POST | `/conversations/{uuid}/messages` | Verified | Отправить |
| POST | `/conversations/{uuid}/read` | Bearer | Пометить прочитанным |
| POST | `/conversations/{uuid}/attachments` | Verified | Файл (multipart `file`) |
| POST | `/conversations/{uuid}/pin` | Verified | Закрепить диалог |
| DELETE | `/conversations/{uuid}/pin` | Verified | Открепить |
| DELETE | `/conversations/{uuid}/history` | Verified | Очистить историю у себя |
| DELETE | `/conversations/{uuid}/messages/{messageUuid}` | Verified | Скрыть у себя |
| DELETE | `/conversations/{uuid}/messages/{messageUuid}/everyone` | Verified | Удалить у всех (автор) |
| POST | `/conversations/{uuid}/messages/{messageUuid}/pin` | Verified | Закрепить сообщение |
| DELETE | `/conversations/{uuid}/messages/{messageUuid}/pin` | Verified | Открепить |
| GET | `/categories/posts/rooms/stats` | Bearer | Статистика комнат категорий |
| GET | `/categories/posts/{parentId}/rooms/stats` | Bearer | Статистика подкатегорий |
| GET | `/categories/posts/{parentId}/rooms/{subId}/members` | Bearer | Участники комнаты |
| GET | `/categories/posts/{parentId}/rooms/{subId}/conversation` | Bearer | Войти в комнату категории |

**Сообщение:** `body?`, `type?`=`text\|voice\|image\|file\|post`, `reply_to_uuid?`, `forwarded_from_message_uuid?`, `post_uuid?`, `media_uuids[]` max 10. Нужен текст, медиа, форвард или пост.

---

### 3.14. Call — звонки WebRTC / LiveKit

**Таблица:** `call_logs`. Телеметрия: `client_logs`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/calls` | Bearer | История |
| GET | `/calls/incoming` | Bearer | Входящий |
| GET | `/calls/ice-servers` | Bearer | STUN/TURN |
| POST | `/calls` | Verified | Начать: `to` (UUID пользователя), `media`=`audio\|video`, `sdp` |
| POST | `/calls/{uuid}/answer` | Verified | Ответить: `sdp` |
| POST | `/calls/{uuid}/restart` | Verified | Пересогласовать: `sdp` |
| POST | `/calls/{uuid}/ice` | Verified | ICE candidate |
| POST | `/calls/{uuid}/reject` | Bearer | Отклонить: `reason?`=`declined\|busy` |
| POST | `/calls/{uuid}/hangup` | Bearer | Повесить трубку |
| POST | `/calls/livekit/token` | Verified | Токен комнаты: `room` |
| POST | `/calls/group/invite` | Verified | Групповой: `room`, `to[]` 1–16 UUID, `media?`, `title?` |
| POST | `/diagnostics/logs` | Bearer | Клиентские логи звонка: `entries[]` max 500 |

---

### 3.15. Video — обзоры

**Таблицы:** `videos`, `video_categories`, `video_reactions`, `video_views`. Комментарии — общая таблица `comments` (полиморф).

Просмотр открыт всем. Публикация и реакции — только с подпиской.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/videos` | optionalAuth | Каталог: `q`, `category`, `tag`, `featured`, `per_page`≤100 |
| GET | `/videos/categories` | optionalAuth | Категории |
| GET | `/videos/tags` | optionalAuth | Теги |
| GET | `/videos/{uuid}` | optionalAuth | Карточка |
| POST | `/videos/{uuid}/view` | optionalAuth | Учесть просмотр |
| GET | `/videos/{uuid}/comments` | optionalAuth | Комментарии |
| POST | `/videos` | Subscription | Загрузить обзор: `title`, `category_id`, `video_media_id`, `description?`, `tags[]?`, `poster_media_id?`, `is_featured?` |
| PATCH | `/videos/{uuid}` | Subscription | Правка (в т.ч. `is_featured`) |
| POST | `/videos/{uuid}/schedule` | Subscription | Отложить |
| DELETE | `/videos/{uuid}/schedule` | Verified | Снять расписание (владелец) |
| POST | `/videos/{uuid}/react` | Subscription | Лайк/реакция |
| DELETE | `/videos/{uuid}/react` | Verified | Убрать реакцию |
| POST | `/videos/{uuid}/comments` | Subscription | Комментарий (как в ленте) |
| DELETE | `/videos/{uuid}` | Verified | Удалить свой |

---

### 3.16. Delivery — СДЭК, Яндекс, отправления

**Таблицы:** `delivery_methods`, `seller_delivery_profiles`, `shipments`, `shipment_events`, `delivery_quotes`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/delivery/cdek/pickup-points` | Публичный | ПВЗ: `city_code`, `type?` |
| GET | `/delivery/cdek/cities` | Публичный | Города СДЭК: `city?` |
| POST | `/delivery/cdek/quote` | Публичный | Тариф: точки, `weight_kg`, `dimensions_cm?` |
| GET | `/delivery/yandex/pickup-points` | Публичный | ПВЗ Яндекса |
| POST | `/delivery/yandex/location/detect` | Публичный | Определить локацию: `location` |
| POST | `/delivery/yandex/quote` | Публичный | Тариф Яндекса |
| GET | `/users/me/delivery-profile` | Bearer | Точки отправки продавца |
| POST | `/users/me/delivery-profile` | Bearer | Добавить: `provider`=`cdek\|yandex`, `point_type`, `external_point_id`, адрес/город |
| PATCH | `/users/me/delivery-profile/{id}` | Bearer | Изменить |
| DELETE | `/users/me/delivery-profile/{id}` | Bearer | Удалить |
| GET | `/shipments` | Bearer | Мои отправления: `role`, `status`, `provider` |
| POST | `/shipments` | Bearer | Создать отправление по объявлению |
| GET | `/shipments/{shipment}` | Bearer | Карточка |
| PATCH | `/shipments/{shipment}` | Bearer | Точки / вес |
| POST | `/shipments/{shipment}/quote` | Bearer | Пересчитать тариф |
| POST | `/shipments/{shipment}/request-seller` | Bearer | Запросить данные продавца |
| POST | `/shipments/{shipment}/confirm` | Bearer | Подтвердить заказ в службе |
| POST | `/shipments/{shipment}/cancel` | Bearer | Отменить |
| POST | `/shipments/{shipment}/sync` | Bearer | Синхронизировать статус |
| POST | `/webhooks/cdek/order-status` | Webhook | Статус заказа СДЭК |
| POST | `/webhooks/yandex/delivery-status` | Webhook | Статус Яндекс Доставки |

Самостоятельные `/shipments` — отдельный контур доставки (чат с продавцом). Безопасная сделка создаёт связанное отправление сама при `ship`, если выбран СДЭК.

---

### 3.17. PublicContent — витрина сайта

**Таблицы:** `banners`, `banner_events`, `faq_*`, `landing_sections`, `landing_cards`, `system_settings`, `icon_assets`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/public/bootstrap` | Публичный | Стартовый пакет фронта (флаги, брендинг, гостевой доступ) |
| GET | `/public/banners` | Публичный | Баннеры |
| POST | `/public/banners/{id}/events` | Публичный | `event`=`impression\|click` |
| GET | `/public/faq` | Публичный | FAQ |
| GET | `/public/stats` | Публичный | Счётчики + «первые N» |
| GET | `/public/landing-blocks` | Публичный | Блоки лендинга |
| GET | `/public/landing-stats` | Публичный | Цифры лендинга |
| GET | `/public/feature-flags` | Публичный | Флаги |
| GET | `/public/feed-guest-access` | Публичный | Что гостю нельзя в ленте |
| GET | `/public/footer-contacts` | Публичный | Контакты футера |
| GET | `/public/branding` | Публичный | Логотип / цвета |
| GET | `/public/delivery-methods` | Публичный | Справочник способов доставки |
| GET | `/public/placement-pricing` | Публичный | Публичные цены размещения |
| POST | `/public/referrals/click` | Публичный | Клик по реф. ссылке: `code` |
| GET | `/icon-overrides` | Публичный | Подмены иконок слотов |

---

### 3.18. Legal — документы, согласия, удаление аккаунта

**Таблицы:** `legal_pages`, `legal_page_revisions`, `rule_pages`, `rule_page_sections`, `footer_links`, `consent_logs`, `cookie_preferences`.

| Метод | Путь | Доступ | Для чего |
|-------|------|--------|----------|
| GET | `/legal/{slug}` | Публичный | Юр. страница (`privacy`, `terms`, `payment`, …) |
| GET | `/rules` | Публичный | Оглавление правил |
| GET | `/rules/{slug}` | Публичный | Страница правил (в т.ч. `safe-deal`) |
| GET | `/footer-links` | Публичный | Ссылки футера |
| POST | `/cookie-preferences` | Публичный | `analytics`, `ads`, `anonymous_key?` |
| GET | `/me/consents` | Bearer | Мои согласия |
| POST | `/consents/{type}/revoke` | Bearer | Отозвать тип согласия |
| GET | `/me/data/export` | Bearer | Выгрузка данных (152-ФЗ) |
| DELETE | `/me` | Bearer | Удалить аккаунт: `confirm` accepted |

---

### 3.19. Report — жалобы

**Таблица:** `reports`.

| Метод | Путь | Доступ | Тело |
|-------|------|--------|------|
| POST | `/reports` | Verified | `type`=`post\|listing\|comment\|user\|video\|conversation\|message`, `target_id` UUID, `reason`=`spam\|offensive\|adult\|fraud\|violence\|copyright\|other`, `description?` |

---

### 3.20. Admin — модерация и управление сайтом

База: Bearer. Два кольца прав.

#### Модератор **или** админ

| Метод | Путь | Для чего |
|-------|------|----------|
| GET | `/admin/moderation/queue` | Очередь: `status`, `queue`, `per_page` |
| POST | `/admin/moderation/{type}/{id}/approve` | Одобрить (`reason?`, `comment?`) |
| POST | `/admin/moderation/{type}/{id}/reject` | Отклонить (`reason` 10–2000) |
| POST | `/admin/moderation/{type}/{id}/revision` | На доработку (`comment` 10–2000) |
| GET | `/admin/reports` | Жалобы: `status`, `target_types` |
| GET | `/admin/reports/{id}` | Карточка жалобы |
| PATCH | `/admin/reports/{id}` | `status`=`reviewing\|resolved\|rejected\|dismissed` |
| GET | `/admin/feedback` | Обращения с формы |
| PATCH | `/admin/feedback/{id}` | `status`=`new\|read\|resolved` |
| GET | `/admin/communities/applications` | Заявки сообществ |
| POST | `/admin/communities/applications/{id}/approve` | Одобрить |
| POST | `/admin/communities/applications/{id}/reject` | Отклонить `reason?` |
| GET | `/admin/channels/applications` | Заявки каналов |
| POST | `/admin/channels/applications/{id}/approve` | Одобрить |
| POST | `/admin/channels/applications/{id}/reject` | Отклонить `reason?` |

`{type}` модерации: очереди контента (`posts`, `listings`, `videos`, …) — как в `moderation_queue.queue`.

#### Только админ

**Дашборд и система**

| Метод | Путь | Для чего |
|-------|------|----------|
| GET | `/admin/dashboard` | Сводка |
| GET | `/admin/diagnostics` | Диагностика |
| GET | `/admin/audit-logs` | Журнал действий |
| GET | `/admin/settings` | `system_settings` |
| PATCH | `/admin/settings` | `settings[]` `{key, value, group?}` |
| POST | `/admin/notifications` | Рассылка: `title`, `body?`, `link?` |
| GET | `/admin/notifications/policy` | Политика каналов уведомлений |
| PUT | `/admin/notifications/policy` | Обновить политику |
| GET | `/admin/feed/guest-access` | Гостевой доступ ленты |
| PUT | `/admin/feed/guest-access` | Обновить (popup/redirect, CTA, actions) |

**Пользователи** (`apiResource`)

| Метод | Путь | Для чего |
|-------|------|----------|
| GET | `/admin/users` | Список: `role`, `status` |
| POST | `/admin/users` | Создать: `email`, `password`, `name?`, `role`, `status` |
| GET | `/admin/users/{uuid}` | Карточка |
| PUT/PATCH | `/admin/users/{uuid}` | Изменить роль/статус/пароль |
| DELETE | `/admin/users/{uuid}` | Удалить |
| GET | `/admin/users/{id}/payout-requisites` | Реквизиты выплат (числовой id) |
| POST | `/admin/users/{uuid}/subscription` | `action`=`activate\|extend\|deactivate`, `days?` 1–3650 |

**Категории** (`apiResource` post / community / listing / video)

Для каждого типа: `GET/POST /admin/categories/{type}`, `GET/PUT/PATCH/DELETE /admin/categories/{type}/{id}`.  
Поля: `name`, `slug`, `parent_id?`, `icon?`, `sort_order?`, `is_active?`, для объявлений ещё `listing_price_cents`, `subscriber_listing_price_cents`.  
`PATCH /admin/categories/video/reorder` — `ids[]`.

**Контент**

| Метод | Путь | Для чего |
|-------|------|----------|
| GET | `/admin/posts` | Посты |
| PATCH | `/admin/posts/{uuid}` | `status` |
| DELETE | `/admin/posts/{uuid}` | Удалить |
| GET | `/admin/listings` | Объявления |
| GET | `/admin/listings/{uuid}` | Карточка |
| PATCH | `/admin/listings/{uuid}` | статус, текст, цена, `rejection_reason` |
| DELETE | `/admin/listings/{uuid}` | Удалить |
| GET | `/admin/videos` | Видео |
| GET | `/admin/videos/{uuid}` | Карточка |
| PATCH | `/admin/videos/{uuid}` | поля обзора + статус |
| DELETE | `/admin/videos/{uuid}` | Удалить |
| GET/POST | `/admin/communities` | CRUD сообществ по `{slug}` |
| GET/PUT/PATCH/DELETE | `/admin/communities/{slug}` | Карточка / правка / удаление |

**Биллинг админки**

| Метод | Путь | Для чего |
|-------|------|----------|
| GET/POST | `/admin/plans` | Тарифы |
| GET/PUT/PATCH/DELETE | `/admin/plans/{slug}` | Карточка тарифа |
| GET/POST | `/admin/promocodes` | Промокоды |
| GET/PUT/PATCH/DELETE | `/admin/promocodes/{code}` | Карточка кода |
| GET | `/admin/referrals` | Рефералы |
| GET | `/admin/promo-pools` | Акции «первые N» |
| POST | `/admin/promo-pools` | Создать пул: `name`, `max_activations`, `expires_at`, `auto_assign_on_register?`, `plan_slug?`, `bonus_kopecks?` |
| POST | `/admin/promo-pools/{uuid}/pause` | Пауза |
| POST | `/admin/promo-pools/{uuid}/resume` | Возобновить |
| POST | `/admin/promo-pools/{uuid}/complete` | Закрыть |
| GET | `/admin/payments` | Платежи: `status`, `from`, `to`, `type` |
| GET | `/admin/payments/export` | CSV |
| GET | `/admin/wallets` | Кошельки: `search` |
| GET | `/admin/wallets/{uuid}` | Кошелёк + транзакции |
| GET | `/admin/withdrawals` | Заявки на вывод |
| PATCH | `/admin/withdrawals/{uuid}` | `status`=`processing\|paid\|rejected`, `admin_comment?` |
| GET | `/admin/safe-deals` | Реестр сделок |
| GET | `/admin/safe-deals/export` | CSV |
| POST | `/admin/safe-deals/{uuid}/release` | Принудительно выплатить продавцу |
| POST | `/admin/safe-deals/{uuid}/refund` | Принудительный возврат покупателю |
| GET | `/admin/disputes` | Споры (`status` по умолчанию `open`) |
| POST | `/admin/disputes/{uuid}/resolve` | Решение: `in_favor_of`=`buyer\|seller\|split`, `resolution?`, при split — `buyer_kopecks` + `seller_kopecks` |

**CMS: баннеры, лендинг, FAQ, legal, футер, иконки, медиа, доставка**

| Метод | Путь | Для чего |
|-------|------|----------|
| GET/POST | `/admin/banners` | Баннеры |
| GET/PUT/PATCH/DELETE | `/admin/banners/{banner}` | Карточка |
| PATCH | `/admin/banners/carousel/settings` | Карусель: `enabled`, `autoplay_seconds` 3–120, `max_slides` 1–10 |
| GET | `/admin/landing/blocks` | Секции лендинга |
| PATCH | `/admin/landing/sections/{slug}` | Текст/медиа секции |
| POST | `/admin/landing/cards` | Карточка секции |
| PATCH | `/admin/landing/cards/reorder` | Порядок |
| PATCH/DELETE | `/admin/landing/cards/{id}` | Правка / удаление |
| GET | `/admin/faq` | Дерево FAQ |
| POST/PATCH/DELETE | `/admin/faq/categories/{id?}` | Категории FAQ |
| POST/PATCH/DELETE | `/admin/faq/articles/{id?}` | Статьи |
| POST | `/admin/faq/articles/reorder` | Порядок статей |
| GET/POST | `/admin/legal-pages` | Юр. страницы |
| POST | `/admin/legal-pages/preview-markdown` | Превью MD |
| GET/PUT | `/admin/legal-pages/{id}` | Карточка |
| POST | `/admin/legal-pages/{id}/publish` | Опубликовать |
| POST | `/admin/legal-pages/{id}/archive` | В архив |
| GET | `/admin/legal-pages/{id}/revisions` | Версии |
| POST | `/admin/legal-pages/{id}/revisions/{revisionId}/restore` | Откат |
| GET/POST | `/admin/rule-pages` | Страницы правил |
| GET/PUT/DELETE | `/admin/rule-pages/{id}` | Карточка |
| POST | `/admin/rule-pages/{id}/publish` | Опубликовать |
| POST | `/admin/rule-pages/{id}/duplicate` | Копия |
| GET | `/admin/rule-pages/{id}/revisions` | Версии |
| POST | `/admin/rule-pages/{id}/revisions/{revisionId}/restore` | Откат |
| GET/POST | `/admin/footer-links` | Ссылки футера |
| PUT/DELETE | `/admin/footer-links/{id}` | Правка |
| POST | `/admin/footer-links/reorder` | Порядок |
| GET | `/admin/icon-assets` | Библиотека иконок |
| POST | `/admin/icon-assets/from-media` | Из медиа: `media_uuid` |
| DELETE | `/admin/icon-assets/{id}` | Удалить |
| GET | `/admin/icon-media` | Медиа для иконок |
| GET | `/admin/media` | Медиатека: `purpose`, `mime` |
| POST | `/admin/media` | Загрузить: `purpose`, `file` |
| GET | `/admin/delivery/methods` | Способы доставки |
| PATCH | `/admin/delivery/methods/{id}` | `name?`, `is_active?`, `sort_order?` |
| POST | `/admin/delivery/methods/reorder` | `order[]` |
| GET | `/admin/delivery/stats` | Статистика доставки |
| GET | `/admin/delivery/shipments` | Все отправления |
| GET | `/admin/delivery/shipments/{shipment}` | Карточка |
| PATCH | `/admin/delivery/shipments/{shipment}` | `status?`, `admin_note?` |

---

## 4. Таблицы базы данных

PostgreSQL. Деньги в биллинге объявлений — **`_cents`**, в кошельке и безопасной сделке — **`_kopecks`** (это одно и то же: 1 ₽ = 100). Публичный id почти везде `uuid`.

Ниже все пользовательские таблицы по зонам. Служебные Laravel: `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `sessions`.

### 4.1. Пользователи и доступ

| Таблица | Назначение |
|---------|------------|
| `users` | Аккаунт: email, phone, `role`, `status`, реф. код, `is_first_hundred`, кредиты размещения |
| `user_profiles` | Публичный профиль, slug, аватар, город, рейтинг, счётчики |
| `email_verification_codes` | OTP email |
| `phone_verification_codes` | OTP SMS |
| `password_reset_tokens` | Сброс пароля |
| `personal_access_tokens` | Bearer Sanctum |
| `user_oauth_accounts` | VK / Yandex / MAX |
| `user_interests` | Интересы → категории постов |
| `user_follows` / `user_blocks` | Подписки / блокировки |
| `friend_requests` / `user_friendships` | Друзья |
| `personal_data_consents` | Согласие на ПДн |
| `notification_preferences` | Каналы уведомлений |
| `notifications` | Inbox |
| `user_two_factor` / `admin_two_factor` | TOTP |
| `user_document_requisites` | ФИО, ИНН, адрес |
| `user_payout_requisites` | Карта / СБП для выплат |
| `saved_payment_methods` | Привязанные карты |
| `pending_email_changes` | Смена email |
| `user_view_history` | Недавно смотрел |
| `user_reviews` | Отзывы после сделки |
| `promo_pools` / `referrals` | Акции и рефералка |
| `permissions`, `roles`, `model_has_*`, `role_has_permissions` | Spatie (не драйвит API) |

### 4.2. Лента и медиа

| Таблица | Назначение |
|---------|------------|
| `posts` | Посты, статус, счётчики, `scheduled_at` |
| `post_media` / `post_hashtags` / `post_reactions` / `post_bookmarks` / `post_reposts` | Связи поста |
| `comments` | Полиморфные комментарии (`parent_id`, `root_id`) |
| `comment_reactions` / `comment_media` | Лайки и фото комментариев |
| `community_pinned_posts` | Закрепы в сообществе |
| `tags` / `taggables` | Хештеги |
| `media` | Файл: диск, путь, mime, variants, статус |
| `media_attachments` | Привязка файла к сущности |
| `upload_sessions` | Пакет presigned upload |
| `media_transcripts` | Расшифровка голоса |

### 4.3. Объявления и доставка

| Таблица | Назначение |
|---------|------------|
| `listings` | Объявление, цена, статус, доставка, бронь `reserved_at` |
| `listing_media` / `listing_favorites` / `listing_status_logs` / `listing_promotions` | Связи |
| `listing_pricing_rules` / `listing_view_daily` | Прайс размещения, статистика |
| `cities` | Города |
| `delivery_methods` | Справочник способов |
| `seller_delivery_profiles` | Откуда продавец отправляет |
| `shipments` / `shipment_events` / `delivery_quotes` | Заказы доставки |

### 4.4. Биллинг и сделка

| Таблица | Назначение |
|---------|------------|
| `subscription_plans` / `user_subscriptions` | Тарифы и подписки |
| `payments` / `payment_items` | Эквайринг подписок, размещения, пополнения |
| `promocodes` / `promocode_usages` | Скидки |
| `bonus_accounts` / `bonus_transactions` | Бонусные баллы (параллельно кошельку) |
| `wallets` | `balance_kopecks`, `held_kopecks` |
| `wallet_transactions` | Леджер |
| `withdrawal_requests` | Вывод (ручная обработка админом) |
| `safe_deals` | Эскроу-сделка |
| `escrow_transactions` | Журнал шагов сделки |
| `disputes` | Споры |
| `safe_deal_incoming_payments` | Входящий платёж ВТБ (ИЭ) |
| `safe_deal_payouts` | Исходящая выплата ВТБ (ОЭ СБП) |
| `safe_deal_gateway_events` | Лог callback/API банка |
| **`escrow_deals`** | **Наследие ЮKassa, в текущем API не используется** |

### 4.5. Сообщества, каналы, чат, видео

| Таблица | Назначение |
|---------|------------|
| `communities` + members / applications / join_requests / events / attendees / topic_categories / subcategories | Хаб сообществ |
| `channels` + subscriptions / posts / media / likes / views / admins / applications | Каналы |
| `icon_assets` | Иконки админки |
| `conversations` + participants / messages / attachments / receipts / hides | Чаты |
| `call_logs` | Звонки |
| `videos` / `video_categories` / `video_reactions` / `video_views` | Обзоры |

### 4.6. Админка, CMS, legal

| Таблица | Назначение |
|---------|------------|
| `moderation_queue` / `moderation_actions` / `reports` | Модерация |
| `moderation_stop_words` / `moderation_banned_patterns` | Фильтры (заготовки) |
| `banners` / `banner_events` | Баннеры |
| `faq_categories` / `faq_articles` | FAQ |
| `support_tickets` / `support_messages` | Тикеты (схема есть) |
| `audit_logs` / `system_settings` / `email_templates` | Система |
| `landing_sections` / `landing_cards` | Лендинг |
| `feedback` / `client_logs` | Обратная связь и телеметрия |
| `legal_pages` + revisions, `rule_pages` + sections/revisions, `footer_links` | Юридический хаб |
| `consent_logs` / `cookie_preferences` | Согласия и cookies |
| `legal_documents` | Старый склад текстов, фактически заменён `legal_pages` |

Категории: `post_categories`, `community_categories`, `listing_categories` — деревья (`parent_id`, `slug`, `path`).

---

## 5. Платёжная система ВТБ и безопасная сделка

Это отдельный контур. Подписка и размещение объявления ходят в **тот же эквайринг ВТБ**, но в таблицу `payments`. Безопасная сделка пишет в `safe_deals` + `safe_deal_incoming_payments`. ЮKassa для эквайринга и эскроу **не используется** (осталась только заготовка привязки карт).

### 5.1. Два продукта банка

| Контур | Что это | Env |
|--------|---------|-----|
| **ИЭ / RBS** — интернет-эквайринг | Покупатель платит картой / СБП на форме банка | `VTB_ACQUIRING_*` |
| **ОЭ** — исходящие выплаты | Перевод продавцу по СБП (B2C) | `VTB_PAYOUT_*` |

Sandbox эквайринга: `https://vtb.rbsuat.com/payment/rest/`.  
Прод: `https://platezh.vtb24.ru/payment/rest/`.

Провайдер обычных платежей (`BILLING_PROVIDER`): `auto` (ВТБ если настроен, иначе stub), `vtb`, `stub`. Stub — тестовая страница оплаты внутри приложения, **не для боя**.

### 5.2. Обычный платёж (подписка, размещение, пополнение кошелька)

```
Клиент POST /payments
  → register.do (ВТБ) или stub
  → checkout_url
Покупатель платит на стороне банка
  → webhook GET/POST /payments/webhooks/vtb  и/или  POST /payments/{uuid}/sync
  → payments.status = paid
  → активируется подписка / кредит размещения / пополнение кошелька
```

`confirm-stub` на live VTB заблокирован.

### 5.3. Безопасная сделка — смысл для клиента

Покупатель оплачивает **цену товара + доставку СДЭК**. Деньги не уходят продавцу сразу:

- комиссия платформы (по умолчанию **5%** от цены товара, не от доставки);
- продавец получит `цена − комиссия`;
- доставка остаётся у платформы (её платит покупатель, платформа рассчитывается со СДЭК).

Срок холда на спор: **14 дней** с оплаты (`SAFE_DEAL_HOLD_DAYS`). Неоплаченный чекаут живёт **30 минут**, потом объявление снова свободно. После статуса «доставлено» автовыплата через **7 дней**, если покупатель молчит (`SAFE_DEAL_AUTO_RELEASE_DAYS`). Cron: `safe-deals:auto-release` каждый час.

### 5.4. Как клиенту провести сделку

1. Объявление `published`, цена > 0, покупатель ≠ продавец, объявление не зарезервировано.
2. Продавец заполнил точку отправки СДЭК, если товар едет СДЭК; указал габариты/`package_size`.
3. Покупатель: `POST /listings/{uuid}/safe-deal/quote` с ПВЗ.
4. Покупатель: `POST /listings/{uuid}/safe-deal` с `accept_terms=true` и тем же `destination_point`.
5. Если escrow = **wallet** — нужны деньги на кошельке, статус сразу `paid`.
6. Если escrow = **vtb** — в ответе `checkout_url`, статус `created`. После оплаты webhook/`GET` сделки → `paid`.
7. Продавец: `POST …/ship` (при СДЭК заказ создаётся сам).
8. Доставка: webhook СДЭК или `POST …/delivered`.
9. Покупатель: `POST …/confirm` → выплата продавцу. Или спор `POST …/dispute`.
10. После `completed`: `POST …/review` (`rating` 1–5).

**Quote / create body**

```json
{
  "accept_terms": true,
  "return_url": "https://modelizmclub.ru/deals/...",
  "destination_point": {
    "city_code": 44,
    "external_point_id": "MSK123",
    "name": "ПВЗ на Ленина",
    "address": "…",
    "latitude": 55.75,
    "longitude": 37.62
  }
}
```

`destination_point.city_code` обязателен, если объект передан. Для СДЭК-объявления ПВЗ обязателен, иначе 422.

**Спор:** `reason` (max 100), `description?` (max 2000), `evidence_uuids[]` max 5 — медиа с `purpose=dispute`.

### 5.5. Статусы сделки

```
created → paid → shipped → delivered → completed
                              ↘ disputed → refunded | completed
        ↘ cancelled / refunded
```

| Статус | Для клиента |
|--------|-------------|
| `created` | Открыта форма банка, объявление зарезервировано |
| `paid` | Деньги в холде |
| `shipped` | Продавец отправил |
| `delivered` | Идёт таймер автовыплаты |
| `completed` | Продавец получил `seller_payout` |
| `disputed` | Ждёт решения админа |
| `refunded` / `cancelled` | Покупателю вернули |

| Действие | Кто | Из каких статусов |
|----------|-----|-------------------|
| ship | продавец (или модератор) | `paid` |
| delivered | участник / модератор / webhook | `paid`, `shipped` |
| confirm | покупатель / модератор / cron | `paid`, `shipped`, `delivered` |
| cancel | участник / модератор | `paid`, `shipped` |
| dispute | участник, пока не истёк `hold_expires_at` | `paid`, `shipped`, `delivered` |
| review | участник, один раз | `completed` |

Чужая сделка: `GET` → 403.

### 5.6. Два режима эскроу

Задаётся `SAFE_DEAL_ESCROW_PROVIDER` = `auto` | `vtb` | `wallet`.  
`auto` = ВТБ, если эквайринг сконфигурирован, иначе внутренний кошелёк.

| | Кошелёк | ВТБ |
|---|---------|-----|
| Откуда деньги | Баланс покупателя на площадке | Карта/СБП на форме банка |
| После create | Сразу `paid`, `held_kopecks` | `created` + `checkout_url` |
| Отмена | Снять холд | `reverse.do` (холд) или `refund.do` (уже списание) |

**Режим списания карты** `SAFE_DEAL_VTB_CAPTURE_MODE`:

| Режим | Что делает банк | Когда деньги уходят с карты | Отмена |
|-------|-----------------|-----------------------------|--------|
| `two_stage` | `registerPreAuth.do` | Только при confirm (`deposit.do`) | `reverse.do` |
| `one_stage` | `register.do` | Сразу при оплате | `refund.do` |

`two_stage` требует у банка услугу **предавторизации**. Если банк её не выдал, checkout падает. В `.env.example` часто стоит `one_stage`, в `config/billing.php` дефолт `two_stage` — сверять при подключении.

Разделение суммы спора (`split`) работает **только** для wallet-сделок. Для one-stage карты API вернёт 422.

### 5.7. Выплата продавцу

При `confirm` / автовыплате / admin release код делает:

1. Capture/refund в ВТБ, если сделка картой.
2. **Всегда** зачисляет `seller_payout` на **кошелёк** продавца.
3. Если включены выплаты ОЭ и у продавца есть СБП-реквизиты — стартует перевод СБП.

Клиент выплат A2C (на карту) в коде **есть**, в боевой цепочке **не вызывается**. Вывод с кошелька (`POST /wallet/withdraw`) — **заявка**, деньги уходят только после ручного `PATCH /admin/withdrawals/{uuid}` админом. Автовывода через ВТБ нет.

### 5.8. Админка сделки

Только `role:admin`: реестр, CSV, принудительный release/refund, очередь споров. Модератор эти экраны не видит.

### 5.9. Cron, связанный с деньгами

| Команда | Расписание | Зачем |
|---------|------------|-------|
| `safe-deals:auto-release` | каждый час | автовыплата, протухание checkout, опрос СБП |
| `subscription:check-expired` | 00:05 | истекшие подписки |

Без работающего scheduler безопасная сделка «залипает» в `delivered` и неоплаченные резервы объявлений не снимаются вовремя.

---

## 6. Что необходимо для полноценной работы безопасной сделки

Разделено: **уже есть в коде** / **нужно на стороне заказчика и банка** / **нужно дописать в продукт**.

### 6.1. Уже реализовано в бэкенде

- Полный цикл wallet-эскроу: холд, отправка, доставка, confirm, cancel, спор, split, отзыв.
- ВТБ two-stage и one-stage, webhook + повторный опрос банка.
- Котировка и заказ СДЭК внутри сделки.
- Журнал `safe_deal_gateway_events`, идемпотентность событий.
- Клиент СБП B2C и опрос статуса выплаты.
- Админ: реестр, CSV, release/refund, споры, кошельки, заявки на вывод.
- Публичные страницы правил (`/rules/safe-deal`, legal).
- Автотесты: `EscrowDealTest`, `SafeDealVtbHoldTest`, `SafeDealCdekCheckoutTest`, `SafeDealVtbSettlementModelsTest` — на сервере **все прошли** (см. главу 7).

### 6.2. Что нужно заказчику / банку / инфраструктуре (без этого «боевая» сделка некорректна)

1. **Боевые учётные данные интернет-эквайринга ВТБ** (`VTB_ACQUIRING_ENABLED=true`, user/password или token, URL `platezh.vtb24.ru`, не sandbox).
2. **Явный выбор capture-режима** с банком: предавторизация (`two_stage`) или сразу списание (`one_stage`). Согласовать договор мерчанта.
3. **URL возврата** (`FRONTEND_URL`, `return_url` в create) и белый список return URL у банка.
4. **Webhook URL**, которые банк реально дергает:  
   `https://api.modelizmclub.ru/api/v1/payments/webhooks/vtb`  
   `https://api.modelizmclub.ru/api/v1/safe-deals/webhooks/vtb`  
   `https://api.modelizmclub.ru/api/v1/safe-deals/webhooks/vtb-payout`
5. **СДЭК в бою:** `CDEK_ENABLED`, боевой account/secure (не тест), продавец обязан иметь профиль отправки и габариты посылки. Иначе quote 422.
6. **Выплаты продавцам:** либо включить ОЭ СБП (`VTB_PAYOUT_*`, OAuth прод `open.api.vtb.ru`) и обязать продавца заполнить телефон СБП, либо оставить только внутренний кошелёк + ручной вывод админом — и честно написать это в оферте.
7. **Scheduler Laravel** на сервере (hourly auto-release). Проверить `php artisan schedule:list` и cron `* * * * * artisan schedule:run`.
8. **Оферта / правила безопасной сделки** опубликованы (`accept_terms` на create — юридический чекбокс).
9. **Флаг на фронте** `feature.escrow_enabled` включён в админке настроек, иначе кнопка сделки скрыта, хотя API работает.
10. Комиссия: настройка `safe_deal.platform_fee_percent` (дефолт 5%). Зафиксировать в договоре.

### 6.3. Что ещё нужно реализовать в коде / процессе (дырки)

Это **не сделано** или сделано опасно. Без пунктов ниже сделку нельзя считать production-complete.

| # | Проблема | Почему важно |
|---|---------|----------------|
| 1 | Флаг `SAFE_DEAL_ENABLED` **не читается** сервисом | API сделки нельзя выключить конфигом. Выключать только фронт-флагом недостаточно |
| 2 | **Двойное зачисление продавцу** | При завершении всегда credit на кошелёк **и** при включённом СБП ещё банковский перевод той же суммы. Нужна политика неттинга: либо только СБП, либо только кошелёк |
| 3 | **A2C на карту не подключён** | Клиент написан и покрыт unit-тестами, `start()` создаёт только канал `sbp`. Либо дописать, либо убрать «карта» из UI выплат |
| 4 | **Чеки 54-ФЗ / ОФД** | Колонки `ofd_*` в `safe_deal_incoming_payments` пустые, сервис чека нет. Для ИП с кассой банк/закон могут требовать фискальный чек |
| 5 | **Webhooks без подписи** | Любой может дернуть URL. Статус оплаты код перепроверяет в банке (подделать `paid` нельзя), но можно устроить шум и лишние запросы. Webhook доставки по `tracking_number` может пометить «доставлено» |
| 6 | **Вывод с кошелька ручной** | Нет автовыплаты заявки `withdrawal_requests` через ВТБ. Операционист обязан обрабатывать очередь |
| 7 | **Split спора недоступен для карты** | Админ не сможет разделить сумму one-stage сделки |
| 8 | Нет сверки ВТБ ↔ `wallets` / входящих платежей | Нет админ-отчёта «банк vs наша книга» |
| 9 | `feature.escrow_enabled` не дублируется на бэкенде | Прямой вызов API обойдёт кнопку на сайте |
| 10 | Переменные `YOOKASSA_SAFE_DEAL_*` в `.env.example` | Путают. К текущей сделке не относятся |
| 11 | Расхождение дефолта capture mode | `.env.example` vs `config/billing.php` |

Минимальный набор доработки продукта, чтобы назвать сделку «правильной» в бою:

1. Серверный запрет, если `SAFE_DEAL_ENABLED=false` или выключен `feature.escrow_enabled`.
2. Одна схема выплаты продавцу (кошелёк **или** СБП, не оба).
3. Секрет/allowlist на webhooks доставки (и по возможности эквайринга).
4. ОФД, если это требует банк/54-ФЗ для данного ИП.
5. Боевой СДЭК + заполненные профили продавцов.
6. Рабочий cron auto-release.
7. Регламент ручных выводов или автовыплата ОЭ.
8. Юридические тексты: комиссия, сроки холда, что происходит при споре и при one-stage refund.

---

## 7. Тесты на сервере (реальные факты)

Прогон **не** на боевой базе `modelizmclub`, а на выделенной `modelizmclub_test` скриптом `deploy/scripts/run-backend-tests.sh` (после тестов скрипт заново кладёт config/route cache).

| Поле | Факт |
|------|------|
| Когда | 3 сентября 2026, **08:53–08:54 UTC** (11:53–11:54 МСК) |
| Где | VPS `cciubpnhtf`, `/var/www/modelizmclub` |
| Git HEAD | `4dd1901d6939a5bdac948a1b30e13d11cfee39ee` от 2026-09-03 05:12:40 UTC |
| Команда | `bash /var/www/modelizmclub/deploy/scripts/run-backend-tests.sh` |
| БД | PostgreSQL `modelizmclub_test` |
| Итог PHPUnit | **5 failed, 392 passed, 2083 assertions** |
| Длительность | **48.86 с** |
| Файлов тестов | 83 |
| Маршрутов `/api/v1` на этом же сервере | **432** |
| После тестов | `config:cache` и `route:cache` успешно |

Это не «все 432 роута вызваны по одному». Это полный набор Feature/Unit тестов репозитория: они бьют по реальным контроллерам, валидации, ВТБ-клиентам (mock HTTP), кошельку и сделке. Роуты без отдельного теста всё равно существуют в `route:list` и описаны в главах 3–5.

### 7.1. Упавшие тесты (как есть)

**`ListingCreateValidationTest` — 2 падения**

Ожидание: после правки уже опубликованного объявления статус станет `pending_moderation` (повторная модерация).  
Факт на сервере: API вернул **`published`**.  
Методы:

- `test_published_listing_update_re_moderates_when_auto_publish_disabled`
- `test_published_listing_update_re_moderates_even_when_auto_publish_enabled`

Смысл для клиента: тест описывает желаемое правило «правка живого объявления снова на модерацию». Текущий код на этой сборке **оставляет объявление опубликованным**.

**`PromoPoolAndReferralRewardTest` — 3 падения**

- `test_admin_can_create_a_promo_pool_and_first_register_takes_a_seat` — после регистрации `promo_pools.current_activations` остался **0**, ожидали **1**.
- `test_pool_stops_granting_after_limit` — то же, счётчик активаций не увеличился.
- `test_register_reads_referral_code` — у нового пользователя `referred_by` = **0**, ожидали id пригласившего.

Смысл для клиента: создание промо-пула и выдача «первого места» / реферала при регистрации на этой сборке **не совпадают с тестами**. Соседний файл `ReferralProgramTest` при этом **прошёл**.

### 7.2. Что прошло — по зонам

Все классы ниже — **PASS** на том же прогоне.

| Зона | Класс | Что проверяют факты тестов |
|------|-------|----------------------------|
| Auth | `AuthFlowTest`, `PhoneVerificationTest`, `OAuthVerificationTest`, `MaxAuthTest`, `MaxLinkTest`, `MaxNotificationTest`, `EnsureFullyVerifiedMiddlewareTest` | Регистрация, SMS, OAuth, MAX, middleware verified |
| Пользователи | `UserModuleTest`, `FriendModuleTest`, `NotificationDeleteTest`, `NotificationPolicyTest`, `FeedbackModuleTest` | Профиль, follow, друзья, уведомления, feedback |
| Лента | `FeedModuleTest`, `FeedGuestAccessTest`, `PostModerationInteractionsTest`, `ReportAndCommentReactionTest` | Посты, комментарии, репосты, жалобы, гостевой доступ |
| Медиа | `MediaVariantsTest`, `ServeMediaRangeTest` | Варианты картинок, Range-запросы |
| Каталог | `CitiesSearchTest`, `AddressSuggestTest`, `CategoryTaxonomyTest`, `CatalogCommunityTest` | Города, адреса, деревья категорий |
| Объявления | `ListingFilterAndExtrasTest`, `ListingPlacementQuoteTest`, `SellerCabinetTest` | Фильтры, цена размещения, кабинет продавца. **CreateValidation — частично FAIL** (см. выше) |
| Биллинг | `BillingModuleTest`, `WalletModuleTest`, `AdminPaymentsTest`, `FirstHundredPromoTest`, `ReferralProgramTest` | ВТБ checkout/webhook, кошелёк, админ CSV, акция/рефералка (кроме PromoPool-файла) |
| **Сделка** | `EscrowDealTest`, `SafeDealVtbHoldTest`, `SafeDealCdekCheckoutTest`, `SafeDealVtbSettlementModelsTest` | Wallet-цикл, VTB hold/capture/refund, СДЭК quote, модели settlement |
| ВТБ клиенты (unit) | `VtbAcquiringClientTest`, `VtbSbpPayoutClientTest`, `VtbA2cPayoutClientTest` | HTTP-клиенты банка |
| Сообщества | `CommunityHubTest`, `CommunityUpdateTest`, `CommunityDeleteTest`, `CommunityBrandingTest`, `SyncCommunityCountersTest` | CRUD, брендинг, счётчики |
| Каналы | `ChannelOwnerTest`, `ChannelUpdateTest`, `ChannelDeleteTest`, `ChannelPostDeleteTest`, `ChannelPostMediaTest`, `ChannelBroadcastTest` | Каналы и посты |
| Чат | `ChatFrontendIntegrationTest`, `ChatListingPublicModuleTest` | Диалоги, чат по объявлению |
| Видео | `VideoSubscriptionAccessTest`, `VideoUploadModerationTest`, `ScheduledVideoTest`, `AdminVideoTest`, `AdminVideoCategoryTest` | Подписка-гейт, модерация, расписание |
| Доставка | `DeliveryIntegrationTest`, `DeliveryMethodsCatalogTest`, `DeliveryQuoteRoundingTest`, `CdekApiExtensionTest` | СДЭК, справочник, округление тарифа |
| Public / legal | `PublicBootstrapTest`, `FeatureFlagsTest`, `FooterContactsTest`, `LegalComplianceTest`, `RulesHubTest`, `EntityRequestsAndIconsTest` | Bootstrap, флаги, 152-ФЗ, правила, иконки |
| Админка | `AdminModuleTest`, `AdminFaqTest`, `AdminLegalPageTest`, `AdminDiagnosticsTest`, `AdminUserDeletionTest` | Пользователи, FAQ, legal, диагностика |
| Прочее | `HealthEndpointTest`, `BackendCompletenessTest`, `ScheduledVideoTest` | Health, полнота бэкенда |

`ExampleTest` (unit + feature) — PASS, служебные.

### 7.3. Как читать покрытие относительно роутов

- **Хорошо покрыты тестами:** auth, лента, кошелёк, платежи, безопасная сделка, сообщества, каналы, видео-гейт подписки, админ-платежи.
- **Есть роуты без отдельного feature-теста** (они работают в коде и в UI, но в PHPUnit нет персонального сценария): часть звонков LiveKit, часть Яндекс-доставки, часть админ-CMS (лендинг-карточки по одной), некоторые тонкие ветки чата. Их контракт — главы 3–5 этого документа и Swagger.

Повторный прогон на той же машине после правок кода изменит цифры. Актуальная команда только `run-backend-tests.sh`, не `php artisan test` против прод-БД.

---

## 8. Связанные материалы

| Документ | Зачем |
|----------|--------|
| [https://api.modelizmclub.ru/docs/api](https://api.modelizmclub.ru/docs/api) | Интерактивные схемы запросов/ответов |
| `docs/openapi/openapi.json` | Машинная спецификация (может отставать от кода) |
| `docs/API.md` | Короткий устаревший конспект, не полный каталог |
| `backend/config/billing.php` | Все дефолты ВТБ и сделки |

---

*Документ собран 3 сентября 2026 по коду модулей `backend/app/Modules/*` и по прогону PHPUnit на VPS. При расхождении с Swagger приоритет у этого файла и у `php artisan route:list` на сервере.*
