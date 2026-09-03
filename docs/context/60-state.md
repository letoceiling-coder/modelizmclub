# 60 — Глобальное состояние

Срез `origin/master` @ `ecb4d60`.

## Что где живёт

| Механизм | Где | Что хранит |
|---|---|---|
| Самописный store на `useReducer` + контекст | `frontend/src/lib/store.ts` (**880 строк**) | почти всё доменное состояние |
| TanStack Query | `frontend/src/router.tsx:7` — единственный `new QueryClient` | 28 вызовов `useQuery`/`useMutation` на весь проект |
| React Context | `components/ThemeProvider.tsx`, `components/access/GuestAccessProvider.tsx` | тема, гостевой доступ |
| Библиотеки состояния | — | zustand/redux/jotai/valtio **не используются** |

## Что лежит в `store.ts`

Нормализованные словари и списки:

```
users, posts, ads, adStatus, dialogs, dialogMeta, communities,
communityMemberships, friendRequests, friendships, blockedUserIds,
hiddenUserIds, favoriteAdIds, dialogAdRefs, pendingDialogMessages,
revealedPhones, deletedChatPartnerIds, currentUserId, sessionResolved
```

Селекторы (`store.ts:854`): `currentUser`, `sessionResolved`, `dialogsList`,
`isBlocked(userId)`, `isAdFavorite(adId)` и другие.

## Три запрошенных среза

### Авторизация

Держится в `store.ts`: `currentUserId` + `sessionResolved`, доступ через
`selectors.currentUser` (возвращает `GUEST_USER`, если пользователя нет).
Токен — отдельно, в `lib/auth/session.ts` (`ensureSession`, `isAuthenticated`,
`restoreSession`, `resetSessionCache`, `signOut`).

Итого состояние сессии размазано по двум местам: факт «кто я» — в сторе,
факт «есть ли валидный токен» — в модуле сессии со своим кэшем.
`ensureSession()` кэширует результат, `resetSessionCache()` его сбрасывает —
то есть третий слой истины.

### Подписка

Отдельного глобального состояния подписки **нет**. В сторе поля подписки нет;
уровень доступа проверяется гвардом `requirePremium` в шести маршрутах
(см. `20-routes-frontend.md`) и запросом `/users/me/subscription` по месту.

### Уведомления

Отдельного глобального состояния тоже нет. Счётчик и список берутся
запросами `/users/me/notifications` и `/users/me/notifications/unread-count`
там, где нужны.

## Где дублируется между Query-кэшем и локальным стейтом

Соотношение говорит само за себя: **28** использований TanStack Query против
**335** `useEffect` и 880-строчного самописного стора (см. `01-baseline.md`).
Основной способ загрузки данных в проекте — `useEffect` + императивный вызов
API + запись результата либо в локальный `useState`, либо в глобальный store.
TanStack Query подключён и настроен, но применяется точечно.

Конкретные точки, где одни и те же данные существуют в двух представлениях:

| Данные | Копия 1 | Копия 2 |
|---|---|---|
| Текущий пользователь | `store.users[currentUserId]` | ответы `/users/me/*` в местах вызова |
| Сессия | `store.sessionResolved` | кэш внутри `ensureSession()` (`lib/auth/session.ts`) |
| Диалоги | `store.dialogs` + `store.dialogMeta` | `syncDialogsFromServer()` перезаписывает store из API |
| Избранное | `store.favoriteAdIds` | `syncFavoritesFromServer()` — то же самое |
| Объявления | `store.ads`, `store.adStatus` | ответы каталога/`my-ads` в компонентах |

Функции `syncFavoritesFromServer` и `syncDialogsFromServer` (`lib/auth/session.ts`)
— это ручная синхронизация серверного состояния в клиентский store, то есть
именно то, что TanStack Query делает сам. Пока они сосуществуют, у части
данных два источника правды и нет общей инвалидации.

## Замечание о demo-режиме

`isDemoMode()` встречается в **19** файлах маршрутов. В demo store заполняется
из `lib/mock.ts` (2000+ строк моков), в реальном режиме — из API. Это третий
режим существования тех же сущностей, и он влияет на то, какие ветки кода
вообще исполняются на стенде.
