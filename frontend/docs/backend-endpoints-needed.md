# Backend Endpoints Needed

> Автоматически формируется при аудите. Код не менять — фиксировать здесь.
> Статусы: `Needed` (нет вообще) | `Existing` (есть, но не используется) | `Missing` (есть похожий, не тот)

---

## 1. Публичный каталог объявлений с фильтрами

**Задача:** #18, #19, #21 + реализовано в CatalogPage (2026-07-04)
**Endpoint:** `GET /listings`
**Метод:** GET

**Текущие query params (работают):**
| Параметр | Тип | Описание |
|---|---|---|
| q | string? | Текстовый поиск |
| per_page | number? | Размер страницы |

**Нужно добавить на бэкенде:**
| Параметр | Тип | Описание |
|---|---|---|
| city_id | number? | Фильтр по городу (city.id из модели Listing) |
| sort | "new" / "price_asc" / "price_desc" / "popular"? | Сортировка |

**Текущий статус frontend:** Реализован с client-side фильтрацией в demo-режиме (`demoListingsFiltered` в `src/lib/demo-data.ts`). В production `city_id` и `sort` передаются в query, но бэкенд их не обрабатывает.

**Demo/mock fallback:** `demoListingsFiltered()` — полная клиентская фильтрация по всем полям CatalogParams.

---

## 2. Блокировка пользователя

**Задача:** #15 (мессенджер blacklist), #17 (друзья block)  
**Endpoint:** `POST /users/{userId}/block`  
**Метод:** POST  
**Payload:** `{}` (пустой)  
**Response:** `{ "message": "ok" }`

**Endpoint разблокировки:** `DELETE /users/{userId}/block`  
**Статус:** `Needed` — нигде нет (`blockUser` в `social.ts` отсутствует).  
**Demo/mock fallback (обновлено 2026-07-05):** `blockedUserIds: ID[]` в
`lib/store.ts` (`actions.blockUser`/`unblockUser`, `selectors.isBlocked`) —
единая user-level блокировка, используется и мессенджером (`ChatHeaderActions`,
send-гейты в `messenger.tsx`), и страницей друзей (`friends.tsx`), и разделом
"Заблокированные" в `/profile` (`BlockedUsersSection`). Симметрия
("Б тоже не видит А") — только клиентская иллюзия в рамках одного
demo-store; реальная двусторонняя блокировка требует серверного
relationship-статуса, видимого обеим сторонам.

---

## 3. Удаление своего сообщения в мессенджере

**Задача:** #15  
**Endpoint:** `DELETE /conversations/{conversationId}/messages/{messageId}`  
**Метод:** DELETE  
**Response:** `{ "message": "ok" }`  
**Статус:** `Needed` — в `chat.ts` нет функции удаления сообщения.  
**Demo/mock fallback:** локальное удаление из store.

**Уточнение (2026-07-05):** UI предлагает только "удалить у себя"
(`deletedForMe` в `Message`, `lib/store.ts` → `deleteMessageForMe`). Опция
"удалить у обоих" сознательно не реализована и не показывается в UI — для неё
нет API.

---

## 4. Закрепление чата (pin conversation)

**Задача:** #15  
**Endpoint:** `POST /conversations/{conversationId}/pin`  
**Метод:** POST  
**Response:** `{ "pinned": true }`  
**Статус:** `Needed`  
**Demo/mock fallback:** `dialogMetaMap` можно расширить полем `pinned`.

---

## 5. Загрузка файла-вложения в мессенджере

**Задача:** #14, #16  
**Endpoint:** `POST /conversations/{conversationId}/attachments`  
**Метод:** POST (multipart/form-data)  
**Payload:** `file: File`  
**Response:**
```json
{ "url": "https://...", "type": "image|file", "name": "...", "size": 12345 }
```
**Статус:** `Needed` — в `chat.ts` есть `uploadVoice`, но нет общего file-upload.  
**Demo/mock fallback:** локальный URL через `URL.createObjectURL`.

**Уточнение (2026-07-05):** нужен единый endpoint для фото/видео/файла —
`type`/`kind` в response уже предусмотрен дизайном. Текущий demo-режим
(`AttachmentMenu`/`handleAttachment` в `messenger.tsx`) создаёт превью через
`URL.createObjectURL` без реальной загрузки; ограничение 20 МБ — client-side
demo guard, не серверная валидация.

---

## 6. Страница «Настройки аккаунта» (будущее)

**Задача:** App Shell — пункт «Настройки» в avatar-меню top bar (2026-07-04)
**Роут:** `/settings` — **отсутствует**
**Статус:** `Needed` — страницы/роута нет. По ТЗ App Shell роуты не трогаем и
функционал не выдумываем, поэтому пункт «Настройки» в avatar-меню **опущен**.
**Что нужно:** отдельная страница настроек аккаунта (профиль, приватность,
уведомления, язык/тема на уровне аккаунта). Когда появится — добавить пункт
«Настройки» в `UserMenu` между «Подписка» и «Выйти».
**Demo/mock fallback:** нет (пункт просто отсутствует в меню).

---

## 7. Media → Listing цепочка (подтверждение)

**Задача:** Catalog Premium Redesign — photo-flow (2026-07-04)
**Endpoints:** `POST /media` (upload) и `POST /listings` (с `media_ids`)
**Статус:** `Existing` — прод-цепочка уже реализована (`uploadMedia` → `createListing`
с `media_ids`). Не меняли.
**Demo/mock fallback:** demo `uploadMedia` возвращает blob-URL (`URL.createObjectURL`);
demo `createListing` использует его как фото и добавляет объявление в demo-каталог
(`demoAddListing`). Так загруженное фото доходит до карточки без реального backend.

**Tech-debt (вне scope):** лента/посты используют `photo()` → `picsum.photos`
(внешний CDN, не грузится на стенде). Каталог переведён на локальные SVG-заглушки;
ленту — отдельной задачей.

---

## 8. Полный перевод лендинга (frontend TODO, не backend)

**Задача:** Landing Hero Fixes (2026-07-04) — переключатель языка убран с
лендинга, т.к. страница не была переведена.
**Статус:** `Needed` — `src/routes/index.tsx` не использует `useTranslation()`;
весь текст (NAV_LINKS, hero copy, секции) хардкожен по-русски.
**Что нужно:** обернуть строки лендинга в `t("landing.…")`, добавить ключи в
`ru/en/zh` locale-файлы, вернуть `LanguageSwitcher` в header лендинга.
**Demo/mock fallback:** нет — до перевода лендинг остаётся русскоязычным,
переключатель убран из его header (App Shell и другие страницы продолжают
использовать `LanguageSwitcher` как есть).

---

## 9. Закрепление сообщения в чате

**Задача:** Мессенджер — базовые функции (2026-07-05)
**Endpoint:** `POST /conversations/{conversationId}/messages/{messageId}/pin`
**Метод:** POST
**Response:** `{ "pinned": true }`
**Endpoint снятия:** `DELETE /conversations/{conversationId}/messages/{messageId}/pin`
**Статус:** `Needed` — в `chat.ts` нет функции pin/unpin сообщения (запись №4
покрывает только pin чата целиком, не сообщения).
**Demo/mock fallback:** `actions.pinMessage(dialogId, messageId)` в
`lib/store.ts` — одно закреплённое сообщение на диалог, хранится в поле
`Message.pinned`.

---

## 10. Пересылка сообщения (forward)

**Задача:** Мессенджер — базовые функции (2026-07-05)
**Endpoint:** предположительно обычный `POST /conversations/{targetId}/messages`
с доп. полем `forwarded_from_message_id` (или отдельный endpoint — уточнить у
бэкенд-команды при реализации).
**Статус:** `Needed` — в `chat.ts` нет функции пересылки.
**Demo/mock fallback:** `ForwardDialog` (`src/components/messenger/ForwardDialog.tsx`)
добавляет сообщение локально в выбранный диалог через `actions.addMessage`,
с полем `Message.forwardedFrom` = id автора оригинала. Реальной доставки
получателю нет — сообщение видно только у пересылающего локально.


---

## 11. Диалог, привязанный к объявлению (плашка объявления в шапке чата)

**Задача:** Финальная приёмка A→B (2026-07-05) — сценарий «B пишет продавцу A
по объявлению; в шапке чата видна плашка объявления».
**Что нужно на бэкенде:** `POST /conversations` (создание диалога) должен
принимать опциональный `listing_id`, а `GET /conversations/{id}` — возвращать
привязанное объявление (id, заголовок, цена, превью). Тогда фронт покажет
плашку объявления в шапке мессенджера.
**Статус:** `Needed` — сейчас `createConversation(peerId, meId)`
(`src/lib/api/chat.ts`) не принимает listing-контекст; `Dialog` не хранит
ссылку на объявление; шапка чата (`messenger.tsx` header) показывает только
собеседника. Плашка объявления НЕ реализована (сознательно не имитируется
глубже demo — это кросс-сущностная связь, требующая серверной модели).
**Demo/mock fallback:** нет. Кнопка «Написать» на карточке объявления
(`ads.$id.tsx` → `writeToSeller`) открывает обычный диалог с продавцом без
привязки к объявлению. Для полноценной плашки нужен backend-контракт выше.

---

## 12. Демо-режим: auth-гейты и создание объявлений (frontend-заметка, не backend)

**Задача:** Финальная приёмка (2026-07-05).
**Статус:** `Frontend-only` — исправлено в этой приёмке, backend не требуется.
**Контекст:** в demo-режиме `getToken()` возвращает null (реальной сессии нет,
demo-пользователь инжектится без токена). Раньше это ломало auth-гейты:
`writeToSeller` в `ads.$id.tsx` и `isAuthed` в `ads.index.tsx` редиректили на
`/login`. Исправлено: гейты стали demo-aware (`!getToken() && !isDemoMode()` /
`getToken() || isDemoMode()`). Также: `makeSeller` (`mock.ts`) теперь включает
`numericId` (иначе «Написать» падало с «Не удалось открыть диалог»);
`demoMyListings` включает созданные в сессии объявления; кнопка
«К моим объявлениям» в success-модалке ведёт на `/my-ads`, а не в каталог.
**Важно для прод-интеграции:** когда подключат реальную auth (не demo),
`getToken()` вернёт настоящий токен, `isDemoMode()` будет false на прод-хосте,
и гейты снова заработают штатно (редирект неавторизованных на /login).

---

## 13. Управление видимостью рекламного баннера (уточнение существующего API, не новый endpoint)

**Задача:** Финальные штрихи (2026-07-05) — «крестик закрытия баннера
убрать у обычного пользователя, управление видимостью — только из /admin».
**Статус:** `Existing, уточнение` — `PATCH /admin/banners/{id}` уже принимает
`is_active` (см. `updateAdminBanner` в `lib/api/admin.ts`, тип patch включал
`is_active?: boolean` ещё до этой задачи). Backend-код не писали, ничего
нового не требуется — только прокинули поле на фронтенде: `Banner.active`
(`lib/mock.ts`), маппинг `active: b.is_active ?? true` в
`fetchAdminBanners`, чекбокс «Показывать» в админке рядом с «Закрепить»
(`admin.tsx`), фильтрация `b.active !== false` в `EventsHero.tsx` (лента) —
клиентская подстраховка на случай, если публичный `/public/banners` ещё не
фильтрует по `is_active` на сервере.
**Просьба уточнить у бэкенд-команды:** действительно ли `GET /public/banners`
уже исключает баннеры с `is_active=false` на уровне сервера (типичная
практика для публичных listing-эндпоинтов) — если нет, это надо добавить
там, чтобы toggle в /admin реально скрывал баннер у всех пользователей, а не
только в demo-фильтрации на фронте.
**Crestик закрытия у обычного пользователя** — убран полностью из
`EventsHero.tsx` (кнопка и связанный dismissed-state удалены); теперь
единственный способ скрыть баннер — снять галочку «Показывать» в /admin.

---

## 14. Обновление аватара профиля

**Задача:** Премиум-доводка (2026-07-05) — смена фото профиля.
**Endpoint:** `PATCH /users/me` с полем `avatar_media_id` (uuid из
`POST /media`, purpose=avatar) для установки; `avatar_media_id: null` — сброс.
**Статус:** `Existing?` — фронт уже шлёт это поле (`updateOwnProfile`).
**Нужно уточнить у бэкенда:** принимает ли `PATCH /users/me` поле
`avatar_media_id` (или оно называется иначе, напр. `avatar_id`/`avatar`).
Если да — ничего не требуется; если нет — добавить.
**Demo/mock fallback:** `uploadMedia("avatar")` в demo возвращает blob-URL,
`setCurrentUser({...me, avatar: url})` обновляет аватар в сторе; сбрасывается
на hard-reload (как весь demo-стейт).
