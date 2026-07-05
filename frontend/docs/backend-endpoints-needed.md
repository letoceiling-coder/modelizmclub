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
**Demo/mock fallback:** флаг `blocked` в `dialogMetaMap` уже есть в store — можно имитировать локально.

---

## 3. Удаление своего сообщения в мессенджере

**Задача:** #15  
**Endpoint:** `DELETE /conversations/{conversationId}/messages/{messageId}`  
**Метод:** DELETE  
**Response:** `{ "message": "ok" }`  
**Статус:** `Needed` — в `chat.ts` нет функции удаления сообщения.  
**Demo/mock fallback:** локальное удаление из store.

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

