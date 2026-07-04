# Catalog Premium Redesign — Design Spec

**Дата:** 2026-07-04
**Проект:** ModelizmClub / МоДелизМ (frontend)
**Область:** строго `frontend/`. Backend, БД, auth, routes, root-конфиги — не трогать.

## Product goal

Каталог `/ads` должен выглядеть и работать как Avito: категории-плитки/чипы
наверху, фильтры скрыты за кнопкой (drawer, не постоянная колонка), крупные
photo-first карточки с чётким фото и жирной ценой. Никаких битых картинок и
дублирования категории.

## Основание

Сравнение с реальным Avito выявило разрыв: у нас постоянно открытая колонка
фильтров на весь экран, категория дублируется (чипы + Select в фильтрах), мелкие
карточки с битыми/отсутствующими фото (крестик-placeholder). Плюс по коду
подтверждён баг: загруженное при создании фото не доходит до карточки в каталоге.

## Ключевые решения (утверждены)

1. **Фильтры:** убрать постоянную панель `AdFiltersDesktop`; кнопка «Фильтры»
   (с бейджем количества активных) открывает существующий `AdFiltersSheet`
   (drawer) на всех ширинах.
2. **Категория:** чипы наверху — единственный контрол категории. Убрать
   `<Select>` «Категория» из `AdFilters`. Подкатегория **остаётся** отдельным
   Select в sheet, показывается когда выбрана категория-чип.
3. **Карточка:** новый компонент `CatalogCard` (photo-first, вертикальный) для
   `/ads`. `ListingCard` (row) остаётся для `/my-ads` — не трогаем.
4. **Битые фото:** локальные SVG-заглушки (data-URI, по категории, без сети) —
   как источник demo-картинок листингов и как onError-fallback.
5. **Photo-flow:** починить цепочку так, чтобы загруженное фото доходило до
   превью (шаг 3) **и** до карточки каталога.
6. **Сетка:** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.

## Найденное в коде (базис дизайна)

- `ads.index.tsx` рендерит `AdFiltersDesktop` (persistent левый сайдбар);
  `AdFiltersSheet` уже существует и используется на мобилке.
- `AdFilters.tsx` Body содержит `<Select>` «Категория» + условный `<Select>`
  «Подкатегория» — дублирует `CategoryChips`.
- `ListingCard.tsx` — горизонтальная row-карточка (thumbnail 80–96px), шарится
  между `/ads` и `/my-ads` (в кабинете нужны status-бейдж, чекбокс, actions).
- Demo-листинги: `mock.ts` → `gal(seeds)` = `picsum.photos/seed/mz-ad{s}/1200/900`
  (внешний CDN, не грузится на стенде → `ImageOff` fallback = «крестик»).
- Photo-flow: `ads.new.tsx` шаг1 `addPhoto` → `URL.createObjectURL` → `form.photos`
  (blob-URL) → шаг3 `ListingPreviewCard images={form.photos}` (превью работает).
  Но: `uploadMedia` (media.ts) **не имеет demo-ветки** — всегда бьёт `/media` API;
  `createListing` (listings.ts) в demo **игнорирует mediaIds**, хардкодит
  `picsum.photos/seed/demo-new-ad`; созданный ad **не сохраняется** в demo-каталог.

## Архитектура

Четыре независимых потока (кандидаты на параллельные таски), все внутри
`frontend/`:

- **Поток A — Фильтры-в-drawer:** `ads.index.tsx` + (никаких новых файлов).
- **Поток B — Дедуп категории:** `AdFilters.tsx`.
- **Поток C — SVG-заглушки:** `lib/placeholder-image.ts` (new) + `mock.ts`.
- **Поток D — CatalogCard + сетка:** `components/ads/CatalogCard.tsx` (new) +
  `ads.index.tsx` (сетка). Зависит от C (fallback-helper).
- **Поток E — Photo-flow fix:** `api/media.ts` + `api/listings.ts` +
  `demo-data.ts`. Зависит от C (заглушка при отсутствии фото).

Порядок для реализации: C → (A, B, D, E могут идти после C). A и D оба трогают
`ads.index.tsx` — их стыковку разрешает whole-file coordination (см. план).

## Компоненты и файлы

### 1. `lib/placeholder-image.ts` (NEW) — поток C

Ответственность: детерминированная SVG-заглушка вместо сетевого фото.

```ts
export function categoryPlaceholder(seed: string | number, category?: string): string
```

- Возвращает `data:image/svg+xml;utf8,...` — SVG с диагональным градиентом
  (два цвета детерминированно по хешу `seed`) + подпись категории (или иконка).
- Без внешних запросов — всегда рендерится, в т.ч. на стенде и офлайн.
- Один и тот же `(seed, category)` → одна и та же картинка (стабильно между
  рендерами).
- Используется как: (а) источник demo-картинок листингов (поток C), (б)
  onError-fallback в `CatalogCard` (поток D), (в) fallback при создании без фото
  (поток E).

### 2. `mock.ts` (MODIFY) — поток C

Ответственность: demo-листинги без битых picsum-картинок.

- Заменить `const gal = (seeds) => seeds.map(s => picsum...)` на генерацию через
  `categoryPlaceholder`. Каждому листингу — заглушка по его `category` и seed
  (первый seed как ключ), плюс несколько вариаций для gallery (разный seed → чуть
  разный градиент), чтобы галерея не была одинаковой.
- Только листинги (`rawAds`/`ads`). `photo()` для постов/ленты — **вне scope**
  (зафиксировать как tech-debt: лента тоже на picsum).

### 3. `components/ads/AdFilters.tsx` (MODIFY) — поток B

Ответственность: фильтры без дубля категории.

- Убрать `<Group title="Категория">` c `<Select>` категории.
- **Оставить** подкатегорию: `<Select>` подкатегории показывается, когда
  `value.category !== "Все"` (берёт список подкатегорий выбранной категории через
  `useListingCategories()`), пишет в `value.subcategory`.
- Остальные группы (Статус, Цена, Город, Состояние, Доставка, Только с фото,
  Сбросить) — без изменений.
- `FiltersState.category` по-прежнему существует и управляется чипами снаружи —
  тип не меняется.

### 4. `components/ads/CatalogCard.tsx` (NEW) — поток D

Ответственность: photo-first карточка каталога.

Пропсы: `{ ad: Ad; className?: string }`.

Разметка (вертикальная):
- Фото сверху: `<Link to="/ads/$id">`, контейнер `aspect-[4/3]`,
  `object-cover`, `overflow-hidden`, `rounded` по токену. Источник
  `ad.gallery?.[0] ?? ad.image`. `onError` → `categoryPlaceholder(ad.id,
  ad.category)` (не крестик).
- Heart-оверлей: кнопка в правом верхнем углу фото (presentational — тоггл
  локального состояния, как визуальный «в избранное»; без API).
- Цена: жирный крупный шрифт (`~20px`, `font-display`, `font-bold`),
  `ad.price.toLocaleString("ru") + " ₽"`.
- Title: 2 строки `line-clamp-2`, средний размер.
- Мета (мелко, `--foreground-50`): город + состояние (без views/likes на
  карточке — минимум второстепенного текста).
- Токены/UI Kit: `Card`, `var(--r-card)`, `var(--shadow-card)`, `var(--border)`,
  `var(--foreground)`/`-50`/`-70`, `var(--accent)`. Без локальных цветов.

### 5. `routes/ads.index.tsx` (MODIFY) — потоки A + D

Ответственность: каталог без постоянной панели, photo-first сетка.

- Убрать `AdFiltersDesktop` и его колонку-обёртку; контент — full-width под
  чипами.
- Добавить кнопку «Фильтры» (в области `AdSortBar` или рядом): открывает
  `AdFiltersSheet` (уже импортирован) на всех ширинах. Бейдж = `activeFilterCount`
  (функция `countActiveFilters` уже есть).
- `AdSortBar` сейчас имеет `onOpenFilters` (кнопка «Фильтры» с `lg:hidden`) —
  снять `lg:hidden`, чтобы кнопка была на всех ширинах. (Если проще — оставить
  вызов `onOpenFilters` и убрать `lg:hidden` в `AdSortBar.tsx`; допустимо в рамках
  потока A.)
- Заменить рендер списка: `ListingCard` → `CatalogCard`; сетка
  `grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4` (скелетоны и empty
  сохранить, скелетон-грид тем же классом).
- Состояния loading/error/empty/data — без изменений логики.

### 6. `api/media.ts` (MODIFY) — поток E

Ответственность: загрузка медиа в demo без реального API.

- В начале `uploadMedia` добавить:
  ```ts
  if (isDemoMode()) {
    const url = URL.createObjectURL(file);
    return { uuid: url, url };
  }
  ```
- `isDemoMode` из `@/lib/demo-mode`. Prod-ветка без изменений.
- Так `mediaIds` в demo несут blob-URL — их подхватит `createListing`.

### 7. `api/listings.ts` (MODIFY) — поток E

Ответственность: созданное объявление с реальным фото, попадает в demo-каталог.

- В demo-ветке `createListing`:
  - `image`/`gallery` брать из `input.mediaIds` (это blob-URL из demo
    `uploadMedia`); если пусто — `categoryPlaceholder(id, category)`.
  - Заполнить `category`/`subcategory`/`city` из доступных полей (категория по
    `input.categoryId` через список категорий, если доступно синхронно; иначе
    оставить пустую строку — не блокер).
  - Вызвать `demoAddListing(demoAd)` (см. demo-data) чтобы объявление появилось в
    каталоге, и вернуть его.

### 8. `lib/demo-data.ts` (MODIFY) — поток E

Ответственность: demo-хранилище пользовательских объявлений.

- Модульный `const demoUserListings: Ad[] = []` + `export function
  demoAddListing(ad: Ad): void { demoUserListings.unshift(ad); }`.
- `demoListingsFiltered(params)` — включать `demoUserListings` в начало базового
  списка перед фильтрацией (созданные видны первыми и участвуют в фильтрах).
- `demoListing(id)` (если используется для карточки объявления) — искать сначала
  в `demoUserListings`, затем в базовом наборе.

## Данные и потоки

- Каталог: `fetchListings(params)` → demo `demoListingsFiltered` (теперь включает
  созданные) → `CatalogCard` рендерит `ad.gallery[0] ?? ad.image`, при ошибке —
  `categoryPlaceholder`.
- Создание: шаг1 `createObjectURL` → `form.photos`/`form.files` → submit
  `uploadMedia` (demo: blob-URL) → `createListing` (demo: image=blob-URL,
  `demoAddListing`) → каталог показывает объявление с реальным фото.

## Состояния для покрытия

- Каталог: loading (скелетоны в новой сетке), error (повтор), empty-unfiltered,
  empty-filtered (сброс), data.
- Sheet: open/close; badge количества активных фильтров (0 → скрыт).
- Категория: активный чип; подкатегория появляется/скрывается.
- Фото: есть (blob/gallery) / нет (SVG-заглушка вместо крестика).

## Что НЕ трогаем

- Backend, БД, auth, routes.
- `/my-ads` и `ListingCard` (row-карточка кабинета).
- `photo()` для постов/ленты (picsum) — вне scope, tech-debt.
- Мобильные `MobileHeader`/`BottomNav`, App Shell top bar/sidebar.

## Backend endpoints

Новых endpoint'ов не требуется. Прод-ветки `uploadMedia`/`createListing` уже шлют
`media_ids` в `/listings` и `/media` — не меняем. Зафиксировать в
`backend-endpoints-needed.md`: подтверждение, что прод-цепочка media→listing уже
описана (статус Existing), demo-цепочка теперь имитирует её локально.

## Acceptance criteria

- В каталоге `/ads` нет постоянной панели фильтров; есть кнопка «Фильтры» с
  бейджем, открывающая drawer на всех ширинах.
- Категория не дублируется: только чипы наверху; в sheet нет Select «Категория»,
  но есть Select «Подкатегория» при выбранной категории.
- Карточки каталога — photo-first (фото сверху, крупная жирная цена, 2 строки
  title, минимум меты), сетка `2 → 3 (sm) → 4 (lg)`.
- Ни одной битой картинки/крестика: demo-листинги и fallback используют
  локальные SVG-заглушки.
- Создание объявления с фото: загруженное фото видно на шаге 3 (превью) **и** на
  карточке в каталоге после публикации (demo).
- `npx tsc --noEmit` чистый.

## Manual QA

Preview + живая проверка на `neeklo.modelizmclub.ru` после мержа:
- `/ads`: нет постоянной панели, есть кнопка «Фильтры» → drawer; чипы —
  единственная категория; подкатегория в sheet; крупные photo-first карточки
  сетка 2/3/4; ни одного крестика.
- Фильтр по категории/городу/цене работает через drawer.
- **Отдельный пункт (ранее не тестировался вживую):** создать тестовое
  объявление с реальным фото (шаг 1 — загрузить файл), проверить превью на шаге 3,
  опубликовать, убедиться что объявление появилось в каталоге **с этим же фото**.
