# Spec: Публичный каталог /ads + Мои объявления /my-ads

**Дата:** 2026-07-04  
**Статус:** Approved  
**Проект:** МоДелизМ / ModelizmClub  

---

## Контекст и проблема

В тестировании зафиксировано: кнопки «Все объявления» и «Смотреть объявления» ведут на `/ads`, который рендерит «Мои объявления» (личный кабинет продавца). Публичного каталога нет. Это блокирует базовый сценарий: гость не может найти объявление.

---

## Цели

- `/ads` = публичный каталог (как Avito: доступен без авторизации)
- `/my-ads` = личный кабинет продавца (только для авторизованных)
- Категории и фильтр по городу видны сразу
- Landing CTA, Sidebar и BottomNav ведут в правильные места

---

## Роуты

| Путь | Компонент | Auth | Описание |
|---|---|---|---|
| `/ads` | `CatalogPage` | нет (guest ok) | Публичный каталог всех объявлений |
| `/ads/$id` | `AdDetailPage` | нет | Карточка объявления |
| `/ads/new` | `CreateAdPage` | да | Создание объявления |
| `/my-ads` | `MyAdsPage` | да | Личный кабинет продавца |

### Изменения файлов роутов

```
routes/ads.index.tsx   → ЗАМЕНИТЬ на CatalogPage (полная перепись)
routes/my-ads.tsx      → НОВЫЙ файл (перенести MyAdsPage из ads.index.tsx)
routes/ads.$id.tsx     → без изменений
routes/ads.new.tsx     → без изменений
routes/ads.tsx         → без изменений (Outlet)
```

---

## CatalogPage — структура UI

### Шапка страницы

```
[H1 «Объявления»] [accent: «Находите и продавайте»]
[CTA-кнопка «Разместить объявление» → /ads/new]  ← только для авторизованных (иначе → /login)
```

### Category Chips (горизонтальный скролл)

- Первый чип: «Все» (активен по умолчанию, сбрасывает категорию)
- Далее: все категории из `useListingCategories()` с иконкой из `lucide-react` по `category.icon`
- Активный чип стилизован через `var(--accent)` / `var(--accent-soft)`
- Горизонтальный overflow-x-auto, scrollbar-width: none
- При клике обновляет `filters.category` и закрывает панель фильтров

### Панель поиска + управления

```
[SearchInput placeholder="Поиск по объявлениям..."]
[кнопка «Фильтры» с иконкой SlidersHorizontal + badge с количеством активных]
[select Сортировка: Новые / Дешевле / Дороже / Популярные]
[кнопки Grid/List переключение]
```

Реализовано через переиспользование `AdSortBar` (расширить пропсами).

### Активные фильтры-теги

Появляются под поиском, если хотя бы один фильтр активен (кроме дефолтных).  
Каждый тег: `[иконка] [значение] [×]`. Клик × сбрасывает конкретный фильтр.  
Последний тег: «Сбросить всё» если активны 2+.

### Грид карточек

- Desktop: `grid-cols-2 xl:grid-cols-3` (или `xl:grid-cols-4` в зависимости от ширины)
- Mobile: `grid-cols-1 sm:grid-cols-2`
- Компонент: существующий `ListingCard` (фото-first)
- List view: переключается через `view: "grid" | "list"` из `AdSortBar`

### States

| State | UI |
|---|---|
| loading | `AdCardSkeleton` × 6 в гриде |
| empty (нет объявлений вообще) | `EmptyState` + кнопка «Разместить первым» |
| empty (фильтр дал 0) | `EmptyState` + «Сбросить фильтры» + «Разместить» |
| error | `Alert` с описанием + кнопка «Повторить» |
| data | грид карточек + пагинация или load-more |

---

## Панель фильтров

Реализация: `Sheet` (мобиль, снизу) / `Drawer` (десктоп, сбоку) — использовать существующий паттерн из `AdFilters`.

### Поля фильтра

| Поле | Компонент | API |
|---|---|---|
| Категория | select / radio | `useListingCategories()` |
| Подкатегория | select (зависит от категории) | из category.subcategories |
| **Город** | CitySelect (input + dropdown) | `searchCities(q)` существует |
| Цена от / до | два `<input type="number">` | клиент |
| Состояние | чекбоксы (Новое / Б/у — отлично / ...) | клиент |
| Статус (Продаю / Куплю / Обменяю) | radio / chips | клиент |
| Только с фото | toggle | клиент |

### CitySelect — отдельный компонент

Файл: `components/ads/CitySelect.tsx`  
- `<input>` с debounce 300ms → `searchCities(q)` → dropdown список
- При выборе сохраняет `{ id: number, name: string }` в состояние фильтров
- Кнопка × для сброса
- Использует существующий `City` тип из `lib/api/cities.ts`

---

## API

### Существующее (используем)

```ts
// lib/api/listings.ts
fetchListings(query?: string): Promise<Ad[]>
// → только q и per_page сейчас

// lib/api/cities.ts
searchCities(q?: string): Promise<City[]>

// lib/hooks/useCategories.ts
useListingCategories(): Category[]
```

### Расширение fetchListings

```ts
export interface CatalogParams {
  q?: string;
  cityId?: number;
  categorySlug?: string;
  priceMin?: number;
  priceMax?: number;
  condition?: string;
  status?: string;
  sort?: "new" | "cheap" | "expensive" | "popular";
  page?: number;
}

export async function fetchListings(params: CatalogParams = {}): Promise<Ad[]>
```

**Demo fallback:** в demo-режиме вся фильтрация применяется клиентски по mock-данным (`ads` из `lib/mock.ts`).  
**Production:** передаём `city_id`, `category_id`, `sort` и др. в query к `/listings`.

### Backend — что нужно

Фиксируем в `frontend/docs/backend-endpoints-needed.md`:
- `GET /listings` расширить: добавить `city_id`, `category_id` / `category_slug`, `price_min`, `price_max`, `condition`, `listing_type` (Продаю/Куплю/Обменяю), `sort` (`new`/`price_asc`/`price_desc`/`popular`)

---

## /my-ads (MyAdsPage)

Текущий `MyAdsPage` из `routes/ads.index.tsx` переезжает **без изменений** в `routes/my-ads.tsx`.  
Роут защищён через `beforeLoad: requireAuth`.  
Единственное изменение: заголовок страницы остаётся «Мои объявления».

---

## Навигация — изменения

### lib/routes.ts

```ts
// Добавить:
myAds: "/my-ads",

// SIDEBAR_ROUTE_MAP: добавить секцию
"my-ads": ["/my-ads"],
```

### Sidebar.tsx

Добавить пункт в `items[]`:
```ts
{ to: ROUTES.myAds, labelKey: "nav.myAds", icon: ClipboardList, section: "my-ads" }
```
Пункт «Объявления» (→ `/ads`) остаётся. Новый «Мои объявления» (→ `/my-ads`) идёт после него.  
«Мои объявления» показывается только авторизованным пользователям (проверка через `useStore(selectors.currentUser)`).

### BottomNav.tsx

«Объявления» уже ведёт в `/ads` — без изменений.

### landing (routes/index.tsx)

Все CTA уже ведут в `/ads` — без изменений (теперь корректно указывают на каталог).

---

## Guest / Auth

| Действие | Гость | Авторизованный |
|---|---|---|
| Открыть `/ads` | ✓ | ✓ |
| Смотреть карточку `/ads/$id` | ✓ | ✓ |
| «Написать продавцу» | → `/login?next=/ads/$id` | ✓ (createConversation) |
| «Сохранить» | → `/login` | ✓ (локально в demo) |
| `/ads/new` | → `/login` | ✓ |
| `/my-ads` | → `/login` | ✓ |

---

## Затронутые файлы

| Файл | Действие |
|---|---|
| `routes/ads.index.tsx` | Полная замена → CatalogPage |
| `routes/my-ads.tsx` | Новый файл → MyAdsPage (перенос) |
| `lib/routes.ts` | Добавить `myAds`, обновить `SIDEBAR_ROUTE_MAP` |
| `lib/api/listings.ts` | Расширить `fetchListings` под `CatalogParams` |
| `components/ads/AdFilters.tsx` | Добавить CitySelect, рефакторинг пропсов если нужно |
| `components/ads/CitySelect.tsx` | Новый компонент |
| `components/layout/Sidebar.tsx` | Добавить пункт «Мои объявления» |
| `frontend/docs/backend-endpoints-needed.md` | Обновить секцию #1 |
| `routeTree.gen.ts` | Автогенерация (не редактировать вручную) |

---

## Acceptance criteria

- [ ] `/ads` показывает публичный каталог, не «Мои объявления»
- [ ] Категории видны наверху страницы как горизонтальные чипы
- [ ] Фильтр по городу: `searchCities` работает, результаты в dropdown
- [ ] «Мои объявления» открываются по `/my-ads`, отдельно от каталога
- [ ] Landing CTA «Смотреть объявления» → `/ads` → каталог
- [ ] Sidebar: «Объявления» → `/ads`, «Мои объявления» → `/my-ads`
- [ ] Нет 404 на старых путях (или редиректы настроены)
- [ ] Mobile 360/390/430 — нет horizontal scroll
- [ ] Desktop 1440 — каталог выглядит как marketplace
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] States: loading/empty/error/data — все реализованы
