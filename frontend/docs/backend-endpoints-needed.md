# Backend Endpoints Needed

> Автоматически формируется при аудите. Код не менять — фиксировать здесь.
> Статусы: `Needed` | `Existing` | `Done` | `Frontend-only`

## Сводка для бэкенд-разработчика (обновлено 2026-07-08)

**Статус интеграции:** пункты №2–5, 9–11, 14 закрыты на **master** (коммиты
`67cf6f5`, `bac81cd` и далее). Backend + frontend wiring + тест
`ChatFrontendIntegrationTest` (331 строка).

| № | Что | Статус | Где |
|---|---|---|---|
| 1 | Каталог с фильтрами (`city_id`, `sort`, …) | `Done` | `IndexListingsController`, `ListingService` |
| 2 | Блокировка пользователя | `Done` | `POST/DELETE /users/{id}/block`, `social.ts` |
| 3 | Удаление сообщения «у себя» | `Done` | `DELETE /conversations/{id}/messages/{uuid}` |
| 4 | Закрепление чата | `Done` | `POST/DELETE /conversations/{id}/pin` |
| 5 | Вложения в чат | `Done` | `POST /conversations/{id}/attachments` |
| 7 | Media → listing | `Existing` | без изменений |
| 9 | Закрепление сообщения | `Done` | `POST/DELETE …/messages/{uuid}/pin` |
| 10 | Пересылка сообщения | `Done` | `forwarded_from_message_uuid` в `POST …/messages` |
| 11 | Диалог ↔ объявление | `Done` | `listing_uuid` при создании, `listing` в `GET` |
| 13 | Видимость баннера | `Existing` | `is_active` в admin API |
| 14 | Аватар профиля | `Done` | `PATCH /users/me` `avatar_media_id` (uuid) |

**Полностью на фронте, backend не нужен:** №6 (страница настроек), №8 (i18n
лендинга), №12 (demo auth-гейты).

**Открытых backend-задач из этого файла нет.** На проде всё включается, когда
`isDemoMode()` false и есть валидный токен.

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

**Текущий статус frontend:** `Done` — в production `city_id`, `sort`, `delivery_method`,
`category_id`, `price_min`/`price_max` передаются в query; бэкенд обрабатывает
(`IndexListingsController`, `ListingService`).

**Demo/mock fallback:** `demoListingsFiltered()` — полная клиентская фильтрация по всем полям CatalogParams.

---

## 2. Блокировка пользователя

**Задача:** #15 (мессенджер blacklist), #17 (друзья block)  
**Endpoint:** `POST /users/{userId}/block`  
**Метод:** POST  
**Payload:** `{}` (пустой)  
**Response:** `{ "message": "ok" }`

**Endpoint разблокировки:** `DELETE /users/{userId}/block`  
**Статус:** `Done` (2026-07-06) — `POST/DELETE /users/{id}/block`, `blockUser`/`unblockUser`
в `social.ts`, тест `ChatFrontendIntegrationTest::test_block_and_unblock_user`.
**Demo/mock fallback:** `blockedUserIds` в `lib/store.ts` — только в demo-режиме.

---

## 3. Удаление своего сообщения в мессенджере

**Задача:** #15  
**Endpoint:** `DELETE /conversations/{conversationId}/messages/{messageId}`  
**Метод:** DELETE  
**Response:** `{ "message": "ok" }`  
**Статус:** `Done` (2026-07-06) — `hideMessageForMe` в `chat.ts`, endpoint
`DELETE /conversations/{id}/messages/{uuid}` (soft hide через `message_user_hides`).
**Demo/mock fallback:** локальное удаление из store (только demo).

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
**Статус:** `Done` (2026-07-06) — `pinConversation`/`unpinConversation` в `chat.ts`.
**Demo/mock fallback:** `dialogMetaMap` с полем `pinned` (только demo).

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
**Статус:** `Done` (2026-07-06) — `uploadChatAttachment` + `sendAttachmentMessage`
в `chat.ts`, `messenger.tsx` вызывает на проде.
**Demo/mock fallback:** `URL.createObjectURL` (только demo).

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

## 8. Полный перевод лендинга (frontend TODO, не backend) — ЗАКРЫТО

**Задача:** Landing Hero Fixes (2026-07-04) — переключатель языка убран с
лендинга, т.к. страница не была переведена.
**Статус:** `Done` (2026-07-05, раунд C) — весь лендинг обёрнут в
`t("landing.…")`, добавлено поддерево `landing.*` в `ru/en/zh` locale-файлы,
`LanguageSwitcher` возвращён в header лендинга (desktop + mobile). Backend не
требовался — чисто frontend-задача.

---

## 9. Закрепление сообщения в чате

**Задача:** Мессенджер — базовые функции (2026-07-05)
**Endpoint:** `POST /conversations/{conversationId}/messages/{messageId}/pin`
**Метод:** POST
**Response:** `{ "pinned": true }`
**Endpoint снятия:** `DELETE /conversations/{conversationId}/messages/{messageId}/pin`
**Статус:** `Done` (2026-07-06) — `pinMessage`/`unpinMessage` в `chat.ts`.
**Demo/mock fallback:** `actions.pinMessage` в `lib/store.ts` (только demo).

---

## 10. Пересылка сообщения (forward)

**Задача:** Мессенджер — базовые функции (2026-07-05)
**Endpoint:** предположительно обычный `POST /conversations/{targetId}/messages`
с доп. полем `forwarded_from_message_id` (или отдельный endpoint — уточнить у
бэкенд-команды при реализации).
**Статус:** `Done` (2026-07-06) — `forwardMessage` в `chat.ts` шлёт
`forwarded_from_message_uuid` в `POST /conversations/{targetId}/messages`.
**Demo/mock fallback:** `ForwardDialog` + локальный `addMessage` (только demo).


---

## 11. Диалог, привязанный к объявлению (плашка объявления в шапке чата)

**Задача:** Финальная приёмка A→B (2026-07-05) — сценарий «B пишет продавцу A
по объявлению; в шапке чата видна плашка объявления».
**Что нужно на бэкенде:** `POST /conversations` (создание диалога) должен
принимать опциональный `listing_id`, а `GET /conversations/{id}` — возвращать
привязанное объявление (id, заголовок, цена, превью). Тогда фронт покажет
плашку объявления в шапке мессенджера.
**Статус:** `Done` (2026-07-06) — `createConversation(userId, meUuid, listingUuid?)`
шлёт `listing_uuid`; `GET /conversations/{uuid}` возвращает `listing` и
`listing_id`. Плашка в шапке чата восстанавливается после reload.
**Demo/mock fallback:** `dialogAdRefs` в store (только demo, без персиста).

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
**Статус:** `Done` (2026-07-06) — `PATCH /users/me` принимает `avatar_media_id`
(uuid из `POST /media`); подтверждено тестом
`test_update_profile_accepts_avatar_media_id_as_uuid`.
**Demo/mock fallback:** blob-URL в store (только demo).

---

## 15. Реальная серверная загрузка файлов/аватара (сводка, блок «D» бэклога)

**Задача:** премиум-бэклог, пункт D — «реальная серверная загрузка вложений/
аватара (сейчас только demo-blob)». Это НЕ новый endpoint, а свод текущего
состояния: во всех местах, где пользователь прикладывает файл, в demo-режиме
используется `URL.createObjectURL(file)` (blob-URL живёт только в текущей
вкладке и теряется на hard-reload). Никакой frontend-работы здесь не требуется —
прод-путь уже написан и включается автоматически, когда `isDemoMode()` false на
прод-хосте. Пункт оставлен как doc-only: **backend-код не пишем.**

**Точки загрузки во фронте и их прод-контракт:**

| Точка | Компонент/функция | Demo сейчас | Прод-контракт (уже в коде) |
|---|---|---|---|
| Фото объявления | `uploadMedia(file,"listing")` → `createListing` | blob-URL | `POST /media` (purpose=listing) → `media_id` → `POST /listings` с `media_ids` (см. №7 — `Existing`) |
| Аватар профиля | `uploadMedia(file,"avatar")` → `updateOwnProfile` | blob-URL | `POST /media` → `PATCH /users/me` `avatar_media_id` (`Done`, см. №14) |
| Вложение в чате (Фото/Видео/Файл, скрепка) | messenger attachment-меню | blob-URL (demo) | `uploadChatAttachment` → `POST /conversations/{id}/attachments` (`Done`, см. №5) |
| Голосовое в чате | `uploadVoice` (`chat.ts`) | — | уже есть (`Existing`) |

**Вывод (обновлено 2026-07-08):** все prod-цепочки из блока D закрыты.
Demo-blob автоматически заменяется реальными URL на прод-хосте, когда
`isDemoMode()` false. Отдельной frontend-задачи по D нет.
