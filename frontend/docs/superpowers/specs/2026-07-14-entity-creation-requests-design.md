# Единый механизм заявок «Создать канал / сообщество» — Design

**Дата:** 2026-07-14
**Scope:** frontend-only; бэкенд документируется в `backend-endpoints-needed.md`, не кодится (стоящее правило сессии, подтверждено пользователем для этой задачи).
**Аудит-основа:** `docs/communities-channels-ownership-audit.md`.

## Контекст

Пользователь физически не может создать свой канал или сообщество —
такого пути в UI нет вообще. Ты либо уже владелец (сидовый демо-аккаунт),
либо нет. Это полный разрыв флоу, не мелкий баг. Задача — дать единый
пользовательский путь «хочу свой» для обеих сущностей через заявку с
модерацией платформой, максимально переиспользуя ОДИН механизм.

### Ключевые находки аудита (кратко)

- **Сообщество** — глубоко реальная сущность на бэке (модель, участники,
  роли `member/moderator`, статусы, вступление/выход). Заявка на создание
  **уже частично есть**: `POST /communities/apply` пишет
  `community_applications`, но это **write-only тупик** — фронт про
  эндпоинт не знает, в админке заявки никто не читает, и при «одобрении»
  сущность никем не создаётся из заявки и заявитель НЕ назначается
  владельцем (роли `owner` в схеме нет вовсе).
- **Канал** — реальная сущность (владение `owner_id`, подписка, публикация
  + дубль в ленту работают), но **создать канал нельзя в принципе**: ни
  модели заявки, ни эндпоинта, ни admin-CRUD.
- Канал ≠ Сообщество (разные поля/семантика). Общее — только паттерн
  «заявка → модерация → создание + владелец»; его и делаем общим.
- Путь «хочу свой» отсутствует для обеих сущностей везде (списки,
  страницы-детали, настройки).

## Решения, зафиксированные при брейншторме

1. **Вариант A**: один параметризованный механизм заявки на фронте
   (общий компонент формы + общий API-слой) для двух сущностей, плюс
   **выделенный** admin-раздел «Заявки на создание» (отдельно от
   «Модерация» — заявка на создание ≠ модерация контента).
2. **Frontend-only**: строим форму заявки, CTA «Хочу свой», «Мой
   канал/сообщество» в настройках, admin-обзор заявок — demo-first.
   Все недостающие бэкенд-звенья документируются, не кодятся.
3. **`kind` канала** (official/brand/shop/author/expert) в форму
   заявителя НЕ входит — это платформенная классификация, её проставляет
   админ при одобрении.
4. **MVP «Мой канал/сообщество»** в настройках = ссылка на существующую
   страницу-деталь. Без нового UI редактирования (YAGNI).
5. Поля формы сверены с реальными моделями — не выдумываются.

## Архитектура

### A. API-слой — `frontend/src/lib/api/entity-requests.ts` (новый файл)

Единый модуль для заявок обеих сущностей (demo-first, паттерн как в
`communities.ts`/`channels.ts` — `if (isDemoMode()) return demoX()` в
начале каждой функции).

```ts
export type EntityKind = "channel" | "community";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface EntityRequest {
  id: string;
  kind: EntityKind;
  proposedName: string;
  description: string | null;
  category: string;          // отображаемое имя категории
  status: RequestStatus;
  createdAt: string;
  applicant: { id: string; name: string; slug?: string };
}

// Заявитель — подача
export function applyCommunity(input: { proposedName: string; description?: string; categoryId: number }): Promise<void>;
export function applyChannel(input: { name: string; description?: string; category: string }): Promise<void>;

// Заявитель — свои заявки (для статуса «на рассмотрении»)
export function fetchMyEntityRequests(): Promise<EntityRequest[]>;

// Категории для формы сообщества
export function fetchCommunityCategories(): Promise<{ id: number; name: string; slug: string }[]>;

// Админ — обзор/решение
export function fetchEntityRequests(status?: RequestStatus): Promise<EntityRequest[]>;
export function approveEntityRequest(kind: EntityKind, id: string): Promise<void>;
export function rejectEntityRequest(kind: EntityKind, id: string, reason?: string): Promise<void>;
```

**Маппинг эндпоинтов:**

| Функция | Реальный эндпоинт | Статус на бэке |
|---|---|---|
| `applyCommunity` | `POST /communities/apply` | **существует** (только подключить) |
| `applyChannel` | `POST /channels/apply` | документируется (нет) |
| `fetchMyEntityRequests` | `GET /me/entity-requests` (или 2 источника) | документируется |
| `fetchCommunityCategories` | `GET /categories/communities` | **существует** (только фетч) |
| `fetchEntityRequests` | `GET /admin/communities/applications` + `GET /admin/channels/applications` | документируется |
| `approveEntityRequest` | `POST /admin/communities/applications/{id}/approve` \| `POST /admin/channels/applications/{id}/approve` | документируется |
| `rejectEntityRequest` | `POST /admin/communities/applications/{id}/reject` \| `POST /admin/channels/applications/{id}/reject` | документируется |

> Плюрализация фиксированная: `community → communities`, `channel → channels`
> (не наивное `+s`). Функции `approve/rejectEntityRequest(kind, id)`
> выбирают сегмент по `kind`.

Demo-режим: `applyX` → тост-успех без сети; `fetchMyEntityRequests` → `[]`
или 1 мок-pending; `fetchEntityRequests` → 2–3 мок-заявки; approve/reject →
оптимистичное локальное удаление.

### B. Общий компонент формы — `frontend/src/components/entity-requests/EntityRequestForm.tsx` (новый файл)

```ts
interface Props {
  kind: EntityKind;
  onClose: () => void;
  onSubmitted: () => void;   // после успешной подачи (закрыть + показать «на рассмотрении»)
}
```

Рендерит поля из per-kind конфига:

- **community**: `proposed_name` (required, min 3, max 120), `description`
  (optional, max 5000), `category_id` — `<select>` из
  `fetchCommunityCategories()`. Ровно поля `ApplyCommunityRequest`.
- **channel**: `name` (required), `description` (optional), `category`
  (строка — свободный ввод или подсказки). Без `kind`.

Сабмит → `applyCommunity`/`applyChannel` → тост «Заявка отправлена на
рассмотрение» → `onSubmitted()`. Ошибка «уже есть pending» (бэк сообществ
её отдаёт `422 application`) → показать «У вас уже есть заявка на
рассмотрении» вместо повторной отправки.

Обёртка-модалка переиспользует существующий паттерн (`CreatePostModal`-style
центрированная на десктопе / полноэкранная на мобиле; либо `vaul` Drawer —
на усмотрение реализации, консистентно с проектом). Мобильная адаптация
обязательна (вьюпорты 360/390/430).

### C. Точки входа

1. **Чужая страница канала/сообщества** — CTA «Хочу свой канал» / «Хочу
   своё сообщество» для зрителя-невладельца.
   - Канал (`channel.$id.tsx`): показывать, если `!channel.isOwner`.
   - Сообщество (`communities.$id.tsx`): показывать всегда (владельца
     сообщества фронт определить не может — см. §E, документируется; до
     появления бэка CTA показывается всем невладельцам по факту
     невозможности определить владение — это честно, не заглушка).
   Клик → `EntityRequestForm` с соответствующим `kind`.

2. **Настройки** (`SettingsNav.tsx`, `settings.*` роуты) — новые строки:
   - Канал: если владеет (`useChannels().find(c => c.isOwner)`) → «Мой
     канал» → `Link` на `/channels/{slug}` (страница-деталь).
     Иначе → «Создать канал» → открывает `EntityRequestForm kind="channel"`.
   - Сообщество: если есть своё (документируемый «my owned communities»,
     §E) → «Моё сообщество» → `Link` на `/communities/{slug}`. Иначе →
     «Создать сообщество» → форма. До появления бэка владения — всегда
     ветка «Создать» (честно; переключение на «Моё» включится, когда
     бэкенд отдаст владение).
   - Реализация: либо 1 новая страница `settings.my-spaces.tsx`
     («Мой канал и сообщество»), либо 2 строки в `SETTINGS_ROWS`. Выбор —
     на этапе плана; для MVP достаточно одной страницы-раздела.

### D. Админка — раздел «Заявки на создание»

- Регистрация секции в `admin.tsx` (реестр `{ id, label, icon, roles }`,
  строки ~71–83): `{ id: "applications", label: "Заявки", icon: Inbox, roles: ["admin"] }`.
  Отдельно от `moderation`.
- **Единый список** заявок обеих сущностей (`fetchEntityRequests(status)`),
  бейдж типа (Канал / Сообщество), фильтр по статусу
  (pending/approved/rejected), новые-сверху. Карточка: заявитель (имя +
  ссылка на профиль), предложенное имя, описание, категория, дата. Контакты
  — через профиль заявителя (отдельных полей контактов в модели заявки нет,
  не выдумываем).
- Действия на pending-карточке: **Одобрить** (`approveEntityRequest`) /
  **Отклонить** (`rejectEntityRequest` с причиной). Оптимистичное убирание
  карточки — паттерн существующих `ModerationCard`.
- Demo: 2–3 мок-заявки, оптимистичные решения локально.

### E. Данные / типы

- Новых полей в `Post`/`Community`/`Channel` фронт-типах не добавляем.
- Тип `EntityRequest` (§A) — новый, единый для обеих сущностей на фронте.
- Владение каналом — `Channel.isOwner` (есть). Владение сообществом —
  **нет способа на фронте** (роли owner нет; `created_by` не отдаётся в
  `CommunityResource`), документируется в §F.

## F. Backend-endpoints-needed.md — новая запись (критичные звенья выделены)

Фронт строится demo-first; реальный режим включается сам при готовом бэке.
Запись должна ЯВНО выделить звенья-блокеры:

- 🔴 **CRITICAL — approve → создать сущность → назначить владельца:**
  - *Сообщество*: одобрение `CommunityApplication` должно **создавать**
    `Community` (`created_by = applicant`, `status = active`,
    `slug = CommunityService::uniqueSlug(name)`) и **attach заявителя
    владельцем** в `community_members`. Для этого **добавить значение
    `owner` в enum `CommunityMemberRole`** (сейчас только
    `member/moderator`) — без этого «назначить инициатора администратором
    сообщества» невозможно. Текущий `ModerationService::approve` для
    `Community` лишь флипает `status` существующей записи и никого не
    назначает — это разрыв.
  - *Канал*: одобрение должно создавать `Channel` с `owner_id = applicant`.
- 🔴 **CRITICAL — admin-стек обзора заявок:**
  - *Сообщество*: `GET /admin/communities/applications` (список),
    `POST .../{id}/approve`, `POST .../{id}/reject` (с
    `moderator_comment`, `reviewed_by`, `reviewed_at` — поля в модели уже
    есть). Сейчас `community_applications` пишется, но **никто не читает**.
  - *Канал*: весь стек новый — таблица+модель `channel_applications`
    (по образцу `community_applications`), `POST /channels/apply`
    (+guard «уже pending»), admin list/approve/reject.
- 🟡 Подключить `applyCommunity` к **существующему** `POST /communities/apply`
  (единственный реальный сегодня; проверить shape ответа
  `CommunityApplicationResource`).
- 🟡 «Мои сообщества, где я владелец» — эндпоинт/поле для «Моё сообщество»
  в настройках и для скрытия CTA «Хочу своё» у владельца (сейчас владение
  сообществом на фронте неопределимо).
- 🟡 `GET /me/entity-requests` — свои заявки со статусом (для «на
  рассмотрении»); может быть 2 источника (community + channel).
- 🟢 `fetchCommunityCategories()` → публичный `GET /categories/communities`
  **уже существует** (`CommunityCategoryTreeController`), нужен только
  фронт-фетч.

## Тестирование / приёмка

- `tsc --noEmit` чист.
- Live на neeklo (demo-режим), вьюпорты 360/390/430 + десктоп:
  - На чужой странице канала и сообщества виден CTA «Хочу свой», открывает
    форму с правильными полями для своей сущности.
  - Форма сообщества: пикер категорий заполнен из `fetchCommunityCategories`;
    валидация (name min 3) работает; сабмит → тост «Заявка отправлена».
  - Форма канала: name/description/category; сабмит → тост.
  - Повторная подача (demo-мок pending) → состояние «У вас уже есть
    заявка на рассмотрении», без второй отправки.
  - Настройки: строки «Создать канал/сообщество» (demo: владения нет →
    ветка «Создать») открывают форму.
  - Админка → «Заявки»: список мок-заявок обеих сущностей с бейджами;
    Одобрить/Отклонить оптимистично убирают карточку; фильтр статуса
    работает.
  - Мобильная форма — не «десктопное окно впритык», без overflow.
- `backend-endpoints-needed.md` дополнен записью с выделенными 🔴-звеньями.

## Не входит в эту фазу (Фаза 2)

- Самообслуживание: владелец сообщества/канала сам создаёт под-сущности /
  приглашает без участия платформы.
- Публикация постов участниками сообщества (отдельная нереализованная
  фича; `SubmitPostSheet` — demo-муляж).
- Редактирование сущности из настроек (MVP «Мой X» = только ссылка).
- Модерация подписчиков/участников владельцем.
- Реальная (не demo) работа флоу — блокирована 🔴-звеньями бэкенда;
  фронт готов принять их без переделки.
