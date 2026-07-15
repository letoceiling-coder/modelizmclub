# Аудит: сущности «Сообщество» и «Канал» + путь «стать владельцем»

**Дата:** 2026-07-14
**Автор:** аудит перед спекой на единый механизм заявок (Канал / Сообщество)
**Метод:** чтение backend-модулей (`backend/app/Modules/{Community,Channel,Admin}`, модели, миграции, роуты) и frontend (`frontend/src/lib/api`, `src/routes`, `src/components`). Демо-режим (`neeklo.modelizmclub.ru` всегда demo по хосту) не влияет на этот аудит — смотрели реальный код и реальную схему БД.

> **Примечание про референс.** Упомянутый заказчиком `modelizm_communities_audit_and_spec.md` в репозитории **отсутствует** (создан в другой сессии/вне репо). Данный аудит построен с нуля по факту кода, а не по тому документу.

---

## 0. Резюме одной строкой

**«Сообщество» — реальная, глубоко смоделированная сущность на бэкенде (модель, участники, роли, статусы, ЗАЯВКА на создание), но фронтенд использует лишь малую часть, а ключевые звенья (обзор заявок в админке, назначение владельца при одобрении, публикация участниками) отсутствуют или разорваны. «Канал» — реальная сущность, но пути создания нет вообще ни на бэке, ни на фронте (владельцем можно только «родиться» — через сид/ручную вставку в БД). Пользовательского пути «хочу свой канал/сообщество» в UI нет ни для одной сущности.**

---

## 1. Таблица состояния — СООБЩЕСТВА

| Раздел | Есть / Частично / Нет | Где в коде | Что нужно добавить |
|---|---|---|---|
| Сущность «Сообщество» в БД | **Есть** | `communities` таблица (`2026_06_15_100004_create_communities_tables.php`); модель `app/Models/Community.php`. Поля: `uuid, category_id, name, slug, description, cover_media_id, avatar_media_id, status, is_official, members_count, posts_count, settings(json), created_by, approved_at` | — (готово) |
| Статусы сообщества | **Есть** | `App\Enums\CommunityStatus`: `draft / pending / active / blocked` | — |
| Участники + роли | **Есть** | `community_members` (pivot: `community_id, user_id, role, joined_at`); `CommunityMemberRole`: `member / moderator`. Связь `Community::members()` | Роли **«owner»** нет — только member/moderator (см. §3, «дыра владельца») |
| Просмотр списка сообществ | **Есть** | `GET /communities` → `IndexCommunityController` → `CommunityService::list` (фильтры q/category/official, сортировка, флаг `is_member` для зрителя). Front: `fetchCommunities` | — |
| Просмотр одного сообщества | **Есть** | `GET /communities/{slug}` → `ShowCommunityController`. Front: `fetchCommunity` | — |
| Вступление / выход | **Есть** | `POST /communities/{slug}/join`, `DELETE /communities/{slug}/leave` (auth) → `CommunityService::join/leave` (инкремент/декремент `members_count`, роль `member`). Front: `joinCommunity/leaveCommunity`, живо работает | — |
| Список участников | **Есть (API)** | `GET /communities/{slug}/members` → `CommunityMembersController`. **Front не использует** | Прокинуть на UI (не в MVP) |
| **Заявка на создание сообщества** | **Частично (write-only, тупик)** | `POST /communities/apply` (auth) → `ApplyCommunityController` → `CommunityService::apply`. Пишет `community_applications` (`user_id, proposed_name, description, category_id, status=pending, moderator_comment, reviewed_by, reviewed_at`), есть guard «уже есть pending». **Front API этого эндпоинта НЕ имеет вообще.** | (1) Front: `applyCommunity()` + форма/кнопка. (2) Backend/Front: обзор заявок в админке — см. ниже |
| **Обзор заявок в админке** | **Нет** | Ни роута, ни контроллера для `community_applications` в `app/Modules/Admin`. Заявка падает в таблицу и её **никто не читает** | Admin-эндпоинты: список заявок, approve/reject |
| **Одобрение заявки → создание сообщества + назначение владельца** | **Нет (разорвано)** | `AdminCommunityController::store` создаёт сообщество **напрямую** (`created_by = admin.id`), НЕ из заявки и БЕЗ привязки заявителя. `ModerationService::approve` для `Community` лишь ставит `status=Active` уже существующей записи. **Никто не превращает `CommunityApplication` → `Community` и не назначает заявителя владельцем/модератором** | Сервисный метод «approve application»: создать Community из заявки, `created_by=applicant`, attach заявителя как owner/moderator |
| Модерация сообществ (админ) | **Частично** | Полиморфная `ModerationQueue` + `ModerationService`; approve «community» → `Community.status=Active+approved_at`, reject → `Blocked`. Front: `admin.tsx` секция «Сообщества на модерации» (`queue.filter(type==="communities")`). **НО**: `CommunityApplication` в `ModerationQueue` никогда не кладётся (grep пуст) — очередь работает по `Community`-записям со статусом pending, которых пользовательский флоу не создаёт | Связать заявку с очередью ЛИБО сделать отдельный обзор заявок |
| Админ CRUD сообществ | **Есть** | `apiResource communities` → `AdminCommunityController` (index/store/show/update/destroy) + `UpsertCommunityRequest`. Front: секция «Сообщества» в `admin.tsx` (`id:"community"`) | — (но store не связан с заявками) |
| **Публикация постов участниками** | **Нет** | `GET /communities/{slug}/posts` только чтение (`CommunityPostsController` инвойк). **`POST` эндпоинта нет.** Front `SubmitPostSheet.tsx` — demo-муляж (`setTimeout`+тост, ноль API), гейтится `Community.allowSubmitPost`, которое реальный маппер никогда не проставляет | Вне scope этой задачи (отдельная фича, была помечена future) |
| **Путь «стать владельцем» в UI** | **Нет** | Ни `communities.index.tsx`, ни `communities.$id.tsx` не имеют кнопки «Создать сообщество» / «Хочу своё». `apply(...)` в index — это фильтр-функция, не заявка | Кнопка/форма заявки (эта спека) |

---

## 2. Таблица состояния — КАНАЛЫ

| Раздел | Есть / Частично / Нет | Где в коде | Что нужно добавить |
|---|---|---|---|
| Сущность «Канал» в БД | **Есть** | `channels` (`2026_06_28_000002_create_channels_tables.php`); `app/Models/Channel.php`. Поля: `uuid, owner_id, name, slug, description, category, kind, avatar_color, banner_color, subscribers_count, is_active` | — |
| Владение | **Есть (серверное)** | `owner_id`; `ChannelResource.is_owner = owner_id === viewer.id`; жёсткий 403 в `storePost` если не владелец. Front: `Channel.isOwner` | — (подтверждено ранее сегодня) |
| Подписка | **Есть** | `POST/DELETE /channels/{slug}/subscribe`. Front: `setChannelSubscription`. Работает | — |
| Публикация владельцем + дубль в ленту | **Есть** | `POST /channels/{slug}/posts` → `ChannelController::storePost` → `duplicateToFeed()` создаёт обычный `Post` через тот же `PostService::create/publish` (категория «Каналы»). Front: `createChannelPost` | — (подтверждено сегодня) |
| Просмотр канала / постов / списка | **Есть** | `GET /channels`, `/channels/{slug}`, `/channels/{slug}/posts`. Front: `fetchChannels/fetchChannel/fetchChannelPosts` | — |
| **Создание канала** | **Нет (нигде)** | Нет `store/create/apply` в `ChannelController` (только index/show/posts/subscribe/unsubscribe/storePost). **Нет admin-контроллера для каналов вообще.** Нет таблицы `channel_applications`. Владельцем можно стать только через сид/ручную вставку `owner_id` в БД | Полностью новый флоу: заявка → модерация → создание Channel + `owner_id=applicant` |
| **Заявка на создание канала** | **Нет** | Нет модели, нет таблицы, нет эндпоинта | Всё новое (эта спека — переиспользуя механизм сообществ) |
| Модерация каналов (админ) | **Нет** | `ModerationType` = `posts / communities / videos` — «channels» нет. Нет admin CRUD каналов | Обзор заявок на канал в админке |
| **Путь «стать владельцем» в UI** | **Нет** | `channels.tsx` без кнопки создания/заявки | Кнопка/форма заявки (эта спека) |

---

## 3. Ключевые находки и «дыры»

1. **Заявка на сообщество — write-only тупик.** `POST /communities/apply` реально пишет `community_applications`, но НИ ОДИН код это не читает: нет admin-роута, заявка не кладётся в `ModerationQueue`, `AdminCommunityController::store` создаёт сообщество мимо заявок. Фронтенд про эндпоинт `apply` вообще не знает (в `communities.ts` его нет).

2. **«Дыра владельца» у сообществ.** При одобрении сообщества (`ModerationService::approve` для `Community`) заявитель **никак не становится владельцем**: `created_by` — это тот, кто создал запись (админ), а `CommunityMemberRole` знает только `member/moderator` (роли `owner` нет). Никто не делает `members()->attach(applicant, role: moderator)`. То есть «назначить инициатора администратором сообщества» — механизма нет, надо добавлять.

3. **Канал vs Сообщество — НЕ дубликаты.** Разные сущности с разной семантикой:
   - *Канал* = односторонняя витрина: только владелец публикует, подписка, пост дублируется в общую ленту. Поля: `category`(строка), `kind`, цвета аватара/баннера.
   - *Сообщество* = группа с участниками и ролями, категория-FK + подкатегории, обложка/аватар-медиа, счётчики участников/постов. Публикация участниками — задумана (`allowSubmitPost`, `community_members.role`), но не реализована.
   Пересечение — только паттерн «заявка → модерация → создание + владелец». Именно его и надо сделать общим.

4. **Создать канал нельзя в принципе.** У сообществ есть хотя бы (разорванный) флоу заявки; у каналов нет ни модели заявки, ни эндпоинта, ни admin-CRUD. Владелец канала на демо-стенде — сидовый (`owner_id` вписан напрямую).

5. **Ни для одной сущности нет UI-пути «хочу свой».** Ни в списках (`communities.index`, `channels`), ни на страницах-деталях, ни в настройках (`SettingsNav` — 10 пунктов, ни «Мой канал», ни «Моё сообщество»). Разрыв флоу подтверждён: ты либо уже владелец (сид), либо никак.

---

## 4. Что из этого переиспользуемо для единого механизма заявок

| Кусок | Готовность | Вывод для спеки |
|---|---|---|
| `community_applications` таблица+модель+статусы | Есть | Взять как эталон формы заявки; для канала — либо аналогичная `channel_applications`, либо одна полиморфная таблица заявок (решение — в спеке) |
| `CommunityService::apply` (+guard «уже pending») | Есть | Паттерн переиспользовать для канала |
| `ModerationQueue` полиморфная + admin approve/reject UI | Есть, но не связано с заявками | Можно подключить заявки в ту же очередь, ЛИБО отдельный admin-раздел «Заявки» |
| `AdminCommunityController::store` (создать Community) | Есть | Переиспользовать логику создания при approve заявки, добавив `created_by=applicant` + attach владельцем |
| `admin.tsx` секция «Сообщества» + moderation cards | Есть | Место для UI-обзора заявок |
| `SettingsNav.tsx` (чистый список пунктов) | Есть | Место для «Мой канал/сообщество» + переход к форме заявки |
| Каналы: любая заявка/создание/admin | **Нет** | Всё новое |

---

## 5. Открытые вопросы для спеки (решаются на этапе дизайна)

1. **Одна полиморфная таблица заявок** (Канал+Сообщество) **или две** (`community_applications` уже есть + новая `channel_applications`)? Существующая таблица заточена под поля сообщества (`category_id`→community_categories); у канала поля другие.
2. **Семантика «владельца сообщества»**: вводить роль `owner` в `CommunityMemberRole`, или трактовать `created_by`+`role=moderator` как владельца? (У канала владелец — простой `owner_id`.)
3. **Заявки в общую `ModerationQueue`** или отдельный admin-раздел «Заявки на создание»?
4. **Объём управления «Мой канал/сообщество»** в настройках для MVP (только ссылка на страницу-деталь, или мини-редактирование базовых полей?).
5. Поля формы заявки на **канал** — свериться с моделью `Channel` (name, description, category-строка, kind?) — не выдумывать.

---

## 6. Явно ВНЕ scope (Фаза 2, не проектируем сейчас)

- Самообслуживание: админ сообщества/канала сам создаёт под-сообщества / приглашает без участия платформы.
- Публикация постов участниками сообщества (отдельная нереализованная фича; `SubmitPostSheet` — муляж).
- Модерация подписчиков/участников владельцем.
