# Friends Page Redesign + Unified User-Level Blocking — Design Spec

## Контекст

`src/routes/friends.tsx` — три вкладки (Все/Онлайн/Заявки), карточки в
`grid sm:grid-cols-2`, действия (Добавить/В друзьях/Заявка отправлена,
Написать) видны всегда, три-точки-меню нет вообще. Блокировки на уровне
пользователя не существует — есть только chat-scoped
`DialogMeta.blocked` (см. `src/lib/store.ts`), появившийся в предыдущей
фиче (мессенджер) и уже используемый в `ChatHeaderActions` (переключатель
блокировки диалога) и `BlockedUsersSection` (раздел "Заблокированные" в
`/profile`).

Это ТЗ требует блокировки "как ВКонтакте" — по пользователю целиком,
симметрично, независимо от того, есть ли диалог с этим человеком. Явное
решение пользователя (владельца продукта) в этой сессии: **одна логическая
система**, user-level блокировка первична и главна; chat-scoped
`dialogMeta.blocked` не исчезает как тип, но перестаёт быть отдельным
"блокировать человека" действием — единственное действие "Заблокировать"
везде в проекте теперь означает user-level блокировку.

## 1. Store — унификация блокировки

**`src/lib/store.ts`**

Новое поле в `AppState`:

```ts
blockedUserIds: ID[];
hiddenUserIds: ID[]; // "скрыть из ленты/рекомендаций", per-friends-page
```

(инициализируются как `[]` в `createInitialState()`).

Новые actions:

```ts
blockUser(userId: ID): void   // симметрично удаляет friendship(s) с этим userId,
                                // отменяет pending-заявки в обе стороны,
                                // добавляет userId в blockedUserIds
unblockUser(userId: ID): void // убирает userId из blockedUserIds
hideUser(userId: ID): void    // добавляет userId в hiddenUserIds (без undo, как
                                // "Скрыть" у постов — те же паттерн/семантика)
```

Новый selector:

```ts
isBlocked(userId: ID) => (s: AppState): boolean =>
  s.blockedUserIds.includes(userId)
```

**Реализация `blockUser` в reducer:**

```ts
case "BLOCK_USER": {
  if (s.blockedUserIds.includes(a.userId)) return s;
  const meId = s.currentUserId;
  return {
    ...s,
    blockedUserIds: [...s.blockedUserIds, a.userId],
    friendships: s.friendships.filter(
      (f) =>
        !(
          (f.userId1 === meId && f.userId2 === a.userId) ||
          (f.userId1 === a.userId && f.userId2 === meId)
        ),
    ),
    friendRequests: s.friendRequests.filter(
      (r) =>
        !(
          (r.fromId === meId && r.toId === a.userId) ||
          (r.fromId === a.userId && r.toId === meId)
        ),
    ),
  };
}
```

Симметрия ("пропадает из списков друг друга") в demo-режиме реализуется
клиентски: `blockedUserIds` — это "кого Я заблокировал", хранится только в
моей локальной сессии (single-user demo store, как и весь остальной
`store.ts` — нет второго живого клиента, чтобы показать эффект у "другой
стороны" без backend). Это ограничение честно фиксируется в
backend-endpoints-needed.md — реальная симметрия ("Б тоже не видит А")
требует серверного relationship-статуса, а не двух независимых локальных
стораджей.

**Миграция `DialogMeta.blocked`:** тип не удаляется (поле остаётся в
интерфейсе `DialogMeta` для обратной совместимости с уже
задеплоенным кодом), но новый "источник истины" для вопроса "заблокирован ли
этот человек" — исключительно `isBlocked(userId)`. `ChatHeaderActions`
"Заблокировать"/"Разблокировать" переключается на `actions.blockUser`/
`unblockUser` и на чтение `isBlocked(partnerId)` вместо `meta.blocked`.
Проверка блокировки перед отправкой сообщения в `messenger.tsx`
(`send`/`sendVoice`/`handleAttachment`) тоже переключается на
`isBlocked(partner.id)` вместо `getMeta(active.id).blocked`.

**`BlockedUsersSection` (`src/components/profile/BlockedUsersSection.tsx`,
уже существует из прошлой фичи)** — репоинт с `dialogMeta`/`dialogsList` на
`blockedUserIds` + прямой lookup пользователя по id (не через диалог, т.к.
заблокировать можно и того, с кем чата никогда не было). Список рендерит
`userById(id)` для каждого `blockedUserIds`, кнопка "Разблокировать" вызывает
`unblockUser(id)`.

## 2. Friends page — макет

**Desktop:** одна колонка вместо `grid sm:grid-cols-2` — `flex flex-col
gap-[10px]` для всех трёх вкладок (Все/Онлайн/Заявки). Карточка шире,
горизонтальный layout: аватар слева, имя/город/интересы по центру,
действия справа (сейчас — перенос действий под текст, из-за чего карточка
выглядит перегруженной на широком экране).

**Карточка друга/рекомендации (вкладки Все/Онлайн):**
- Видимые действия: **Написать** (ghost-кнопка, существующий `writeTo`),
  кнопка-состояние **Добавить**/**Заявка отправлена**/**В друзьях**
  (существующий `toggleFriend`, без изменений в логике) — обе кнопки
  переезжают в правую часть карточки вместо блока под текстом.
- Three-dots меню (новое, `FriendActionsMenu`) справа от action-кнопок.

**Карточка заявки (вкладка Заявки):** без изменений в содержимом (Принять/
Отклонить), плюс тот же `FriendActionsMenu` — заявка тоже "человек", блокировка
должна быть доступна и здесь.

**`FriendActionsMenu` (новый компонент,
`src/components/friends/FriendActionsMenu.tsx`)** — паттерн идентичен уже
существующему `MessageActionsMenu` (three-dots на hover/клик, `forwardRef` +
`useImperativeHandle` не нужен здесь — только клик, long-press/mobile-portal
нужен по тем же причинам, что в `MessageActionsMenu`, т.к. карточки тоже
рендерятся внутри анимированного `motion.div` через framer-motion
(`AnimatePresence`/`variants` в списке), что ломает `position: fixed` на
мобильном bottom-sheet — используется тот же `createPortal(document.body)`
фикс).

Пункты меню:
1. Смотреть профиль → `navigate({ to: "/user/$id", params: { id: u.slug ?? u.id } })`
2. Удалить из друзей → существующий `removeFriend` (только если `isAdded`,
   иначе пункт не рендерится — уже есть видимая кнопка-тоггл для этого случая)
3. Скрыть из ленты/рекомендаций → `actions.hideUser(u.id)` + toast
   ("Скрыто из рекомендаций", без undo)
4. Пожаловаться → `toast("Жалоба: будет доступно позже")` (существующий
   в проекте плейсхолдер-паттерн, как в `PostActionMenu`/messenger)
5. Заблокировать → `actions.blockUser(u.id)` (danger/красный), карточка сразу
   пропадает из текущего списка (т.к. `filteredUsers`/`requests` фильтруются
   по `!isBlocked`)

**Фильтрация:** `filteredUsers` (вкладки Все/Онлайн) и `requests` (вкладка
Заявки) дополнительно фильтруются условием `!isBlocked(u.id)` и
`!hiddenUserIds.includes(u.id)` (только для Все/Онлайн — скрытие из
рекомендаций не должно прятать входящую заявку от того же человека, это
разные намерения пользователя).

**Mobile:** кнопки увеличиваются до 44px (сейчас `h-[32px]`) — соответствует
паттерну, применённому в прошлой фиче (мессенджер). Меню
`FriendActionsMenu` — bottom-sheet на `<640px`, тот же портал-фикс.

## Что не делается (YAGNI)

- "Добавить в список" — списки друзей нигде не реализованы в проекте,
  пункт не добавляется вообще (ни как disabled, ни как заглушка) — прямое
  условие из самого ТЗ ("если списки друзей реализованы").
- Настоящая серверная симметрия блокировки (видно у "другой стороны") — вне
  scope demo-режима с одним локальным store; фиксируется как backend-need.
- Undo для "Скрыть из рекомендаций" — согласовано с существующим паттерном
  `PostActionMenu`, тоже без undo.

## Backend-endpoints-needed.md — обновления

Существующая запись №2 ("Блокировка пользователя") уточняется: убрать
формулировку "флаг `blocked` в `dialogMetaMap` можно имитировать локально"
(это было временное решение из прошлой фичи) — заменить на актуальный
demo-fallback: `blockedUserIds` в `lib/store.ts`, симметрия только
клиентская (в реальной интеграции нужен серверный relationship-статус,
видимый обеим сторонам).

Новая запись: **Скрытие пользователя из рекомендаций** — если в будущем
понадобится серверная персистентность (сейчас это чисто client-side
session state, сбрасывается при обновлении страницы, т.к. `hiddenUserIds`
не персистится нигде, как и весь остальной demo-store).
