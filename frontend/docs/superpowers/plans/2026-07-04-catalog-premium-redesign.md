# Catalog Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать каталог `/ads` как на Avito — фильтры в drawer, photo-first крупные карточки, локальные SVG-заглушки вместо битых picsum, и починить цепочку «загруженное фото → карточка каталога».

**Architecture:** Пять потоков в `frontend/`: SVG-заглушки (helper + mock), дедуп категории (AdFilters), CatalogCard (new) + сетка 2/3/4, фильтры-в-drawer (ads.index + AdSortBar), photo-flow fix (media/listings/demo-data). Порядок: helper первым (Task 1), затем остальные; Task 4 зависит от CatalogCard (Task 3).

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind + CSS-токены, lucide-react, UI Kit 2.0 (`Card`, `Badge`).

## Global Constraints

- Работать строго внутри `frontend/`. Не трогать backend, БД, auth, routes, root-конфиги.
- `/my-ads` и `ListingCard` (row-карточка кабинета) — НЕ трогать.
- `photo()` для постов/ленты (picsum) — вне scope, tech-debt.
- Использовать только существующие дизайн-токены и shared UI-компоненты; без локальных цветов.
- Категория: чипы наверху — единственный контрол; в sheet нет Select «Категория», есть Select «Подкатегория» при выбранной категории.
- SVG-заглушки: детерминированные, без сети (data-URI). Как источник demo-картинок листингов И как onError-fallback.
- Photo-flow: demo `uploadMedia` возвращает blob-URL; demo `createListing` берёт фото из mediaIds и добавляет объявление в demo-каталог.
- Сетка каталога: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.
- TypeScript strict, без `any`. После изменений `npx tsc --noEmit` (из `frontend/`) чистый.
- Нет unit-тест-раннера (Vitest/RTL не настроены). «Тест» задачи = `npx tsc --noEmit` + указанные grep-проверки + (в Task 6) preview-QA. Не писать/запускать unit-тесты.
- Не коммитить мерж без явного разрешения; коммиты по таскам разрешены.

---

### Task 1: SVG-заглушка `categoryPlaceholder` + замена picsum в листингах

**Files:**
- Create: `frontend/src/lib/placeholder-image.ts`
- Modify: `frontend/src/lib/mock.ts` (функция `gal` ~строка 303 и `rawAds.map` ~строка 342)

**Interfaces:**
- Produces: `export function categoryPlaceholder(seed: string | number, category?: string): string` — возвращает `data:image/svg+xml;utf8,...`. Используется в Task 3 (CatalogCard fallback) и Task 5 (createListing fallback).

- [ ] **Step 1: Проверить, что файла нет**

Run: `ls frontend/src/lib/placeholder-image.ts 2>&1`
Expected: `No such file or directory`.

- [ ] **Step 2: Создать helper**

Создать `frontend/src/lib/placeholder-image.ts`:

```ts
// Детерминированная SVG-заглушка для demo-картинок и onError-fallback.
// Без сетевых запросов — всегда рендерится (в т.ч. на стенде/офлайн).

const CATEGORY_COLORS: Record<string, [string, string]> = {
  "Автомодели": ["#c8102e", "#6e0f1c"],
  "Самолёты": ["#1e73be", "#0d3a63"],
  "Корабли": ["#0e7490", "#083344"],
  "Квадрокоптеры": ["#7c3aed", "#3b1d6e"],
  "Электроника": ["#0891b2", "#083344"],
  "Аккумуляторы": ["#ca8a04", "#713f12"],
  "Радиоаппаратура": ["#4338ca", "#1e1b4b"],
  "Электросамокаты": ["#059669", "#064e3b"],
  "Разработчики": ["#475569", "#1e293b"],
  "Запчасти": ["#b45309", "#5c2e07"],
};

const FALLBACK_COLORS: [string, string] = ["#374151", "#1f2937"];

function hashSeed(seed: string | number): number {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function categoryPlaceholder(seed: string | number, category?: string): string {
  const [c1, c2] = (category && CATEGORY_COLORS[category]) || FALLBACK_COLORS;
  const angle = hashSeed(seed) % 360;
  const label = (category || "МоДелизМ").toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
    `<defs><linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="800" height="600" fill="url(#g)"/>` +
    `<text x="400" y="312" font-family="system-ui,sans-serif" font-size="40" font-weight="700" ` +
    `fill="rgba(255,255,255,0.82)" text-anchor="middle" letter-spacing="1">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
```

- [ ] **Step 3: Заменить picsum на заглушки в mock.ts**

В `frontend/src/lib/mock.ts` добавить импорт вверху (рядом с другими импортами, после первой строки-импорта или в начале, если импортов нет — тогда первой строкой файла):

```ts
import { categoryPlaceholder } from "@/lib/placeholder-image";
```

Затем заменить строку:
```ts
const gal = (seeds: number[]) => seeds.map((s) => `https://picsum.photos/seed/mz-ad${s}/1200/900`);
```
на:
```ts
const gal = (seeds: number[], category: string) => seeds.map((s) => categoryPlaceholder(`mz-ad${s}`, category));
```

И в `rawAds.map` заменить строку:
```ts
  const gallery = gal(seeds);
```
на:
```ts
  const gallery = gal(seeds, rest.category);
```

(В том же map `rest` уже содержит `category` — деструктуризация `const { seeds, sellerStats, ...rest } = r;` остаётся как есть.)

- [ ] **Step 4: Проверка tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Проверка отсутствия picsum в листингах**

Run: `grep -n "picsum" frontend/src/lib/mock.ts`
Expected: совпадения ТОЛЬКО в `photo()` (посты/ленты) и в строках постов; в `gal`/листингах picsum быть не должно. Конкретно `grep -n "gal =" frontend/src/lib/mock.ts` должен показывать `categoryPlaceholder`, не `picsum`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/placeholder-image.ts frontend/src/lib/mock.ts
git commit -m "feat(catalog): SVG category placeholders, drop picsum from demo listings"
```

---

### Task 2: Убрать дубль категории из AdFilters (оставить подкатегорию)

**Files:**
- Modify: `frontend/src/components/ads/AdFilters.tsx` (функция `Body`, блок `<Group title="Категория">`)

**Interfaces:**
- Consumes: `useListingCategories()`, `FiltersState` (поля `category`, `subcategory` не меняются).
- Produces: нет новых экспортов.

**Контекст:** Сейчас Body содержит:
```tsx
      <Group title="Категория">
        <Select
          value={value.category}
          onChange={(v) => onChange({ ...value, category: v, subcategory: "Все" })}
          options={["Все", ...categories.map((c) => c.name)]}
        />
        {cat && (
          <Select
            value={value.subcategory}
            onChange={(v) => set("subcategory", v)}
            options={["Все", ...cat.subcategories.map((s) => s.name)]}
          />
        )}
      </Group>
```
где `const cat = categories.find((c) => c.name === value.category);`. Категория дублирует `CategoryChips`. Нужно убрать Select категории, оставить подкатегорию (появляется при выбранной категории-чипе).

- [ ] **Step 1: Заменить блок «Категория» на «Подкатегория»**

В `frontend/src/components/ads/AdFilters.tsx`, в функции `Body`, заменить блок выше на:

```tsx
      {cat && (
        <Group title="Подкатегория">
          <Select
            value={value.subcategory}
            onChange={(v) => set("subcategory", v)}
            options={["Все", ...cat.subcategories.map((s) => s.name)]}
          />
        </Group>
      )}
```

(`cat` уже вычисляется выше в `Body` из `value.category`. Когда категория = «Все», `cat` undefined → блок подкатегории скрыт. Когда категория выбрана чипом — показывается подкатегория.)

- [ ] **Step 2: Проверка tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок. Если `cat` оказался неиспользуемым где-то ещё — проверить, что он используется только в этом блоке; предупреждений об unused быть не должно, т.к. `cat` теперь используется в условии.

- [ ] **Step 3: Проверка отсутствия Select категории**

Run: `grep -n "options={\[\"Все\", ...categories.map" frontend/src/components/ads/AdFilters.tsx`
Expected: пусто (Select со списком всех категорий удалён).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ads/AdFilters.tsx
git commit -m "feat(catalog): remove duplicate category Select from filters, keep subcategory"
```

---

### Task 3: `CatalogCard` — photo-first карточка каталога

**Files:**
- Create: `frontend/src/components/ads/CatalogCard.tsx`

**Interfaces:**
- Consumes: `Ad` из `@/lib/mock`, `categoryPlaceholder` из `@/lib/placeholder-image` (Task 1), `Card` из `@/components/ui/card`.
- Produces: `export function CatalogCard({ ad, className }: { ad: Ad; className?: string }): JSX.Element`. Используется в Task 4 (`ads.index.tsx`).

**Контекст:** Вертикальная photo-first карточка. `Ad` имеет `id, title, price, city, condition?, image, gallery?, category`. onError фото → SVG-заглушка. Токены как в `ListingCard` (`var(--r-card)`, `var(--shadow-card)`, `var(--border)`, `var(--foreground)`/`-50`/`-70`, `var(--accent)`).

- [ ] **Step 1: Проверить, что файла нет**

Run: `ls frontend/src/components/ads/CatalogCard.tsx 2>&1`
Expected: `No such file or directory`.

- [ ] **Step 2: Создать компонент**

Создать `frontend/src/components/ads/CatalogCard.tsx`:

```tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import type { Ad } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { cn } from "@/lib/utils";

export function CatalogCard({ ad, className }: { ad: Ad; className?: string }) {
  const [fav, setFav] = useState(false);
  const initial = ad.gallery?.[0] ?? ad.image ?? "";
  const [src, setSrc] = useState(initial);

  return (
    <Card
      className={cn(
        "group relative flex flex-col overflow-hidden p-0",
        "rounded-[var(--r-card)] border-[var(--border)] shadow-[var(--shadow-card)]",
        className,
      )}
      style={{ transition: "box-shadow 180ms, transform 180ms" }}
    >
      {/* Photo */}
      <Link
        to="/ads/$id"
        params={{ id: ad.id }}
        className="relative block aspect-[4/3] w-full overflow-hidden"
        style={{ background: "var(--background-surface)" }}
      >
        <img
          src={src}
          alt={ad.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={() => {
            const ph = categoryPlaceholder(ad.id, ad.category);
            if (src !== ph) setSrc(ph);
          }}
        />
        <button
          type="button"
          aria-label={fav ? "Убрать из избранного" : "В избранное"}
          onClick={(e) => {
            e.preventDefault();
            setFav((v) => !v);
          }}
          className="absolute right-[8px] top-[8px] grid h-[32px] w-[32px] place-items-center rounded-full"
          style={{
            background: "color-mix(in oklab, var(--background) 78%, transparent)",
            backdropFilter: "blur(6px)",
            color: fav ? "var(--accent)" : "var(--foreground-70)",
          }}
        >
          <Heart size={16} fill={fav ? "var(--accent)" : "none"} />
        </button>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-[4px] p-[10px] sm:p-[12px]">
        <div
          className="text-[18px] font-bold leading-none sm:text-[20px]"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)", letterSpacing: "-0.01em" }}
        >
          {ad.price.toLocaleString("ru")} ₽
        </div>

        <Link
          to="/ads/$id"
          params={{ id: ad.id }}
          className="line-clamp-2 text-[13px] font-medium leading-[1.35] sm:text-[13.5px]"
          style={{ color: "var(--foreground-70)" }}
        >
          {ad.title}
        </Link>

        <div className="mt-auto flex items-center gap-[8px] pt-[4px] text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
          <span className="inline-flex min-w-0 items-center gap-[4px]">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{ad.city}</span>
          </span>
          {ad.condition && <span className="shrink-0 truncate">· {ad.condition}</span>}
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Проверка tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок. Если `Card` не принимает `p-0`/className override — он принимает `className` (проверено в `ListingCard`). Если `cn` путь иной — импорт `@/lib/utils` уже используется в `ListingCard`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ads/CatalogCard.tsx
git commit -m "feat(catalog): photo-first CatalogCard with SVG fallback"
```

---

### Task 4: Каталог — фильтры в drawer + photo-first сетка

**Files:**
- Modify: `frontend/src/routes/ads.index.tsx`
- Modify: `frontend/src/components/ads/AdSortBar.tsx` (кнопка «Фильтры»)

**Interfaces:**
- Consumes: `CatalogCard` (Task 3), `AdFiltersSheet` (существует), `AdSortBar` (модифицируется), `countActiveFilters` (существует в ads.index.tsx).
- Produces: нет новых экспортов.

**Контекст:** Сейчас `ads.index.tsx` рендерит `AdFiltersDesktop` в левой колонке (`<div className="flex gap-[20px]">` → `AdFiltersDesktop` + контент). Скелетоны и данные в сетке `grid gap-[10px] sm:grid-cols-2` с `ListingCard`. `AdSortBar` имеет кнопку «Фильтры» с классом `lg:hidden` и проп `onOpenFilters`. Нужно: убрать desktop-панель, показать кнопку «Фильтры» с бейджем на всех ширинах, заменить карточки на `CatalogCard`, сетка 2/3/4.

- [ ] **Step 1: AdSortBar — кнопка «Фильтры» на всех ширинах + бейдж**

В `frontend/src/components/ads/AdSortBar.tsx`:

(1) Добавить в `interface Props` поле:
```tsx
  filterCount?: number;
```
(2) В сигнатуре `export function AdSortBar({ query, onQuery, sort, onSort, onOpenFilters, count }: Props)` добавить `filterCount`:
```tsx
export function AdSortBar({ query, onQuery, sort, onSort, onOpenFilters, count, filterCount = 0 }: Props) {
```
(3) Заменить кнопку «Фильтры»:
```tsx
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex items-center justify-center gap-[8px] px-[16px] text-[14px] font-medium lg:hidden"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-button)",
            height: 44,
          }}
        >
          <SlidersHorizontal size={16} /> Фильтры
        </button>
```
на (убрать `lg:hidden`, добавить бейдж):
```tsx
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex items-center justify-center gap-[8px] px-[16px] text-[14px] font-medium"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-button)",
            height: 44,
          }}
        >
          <SlidersHorizontal size={16} /> Фильтры
          {filterCount > 0 && (
            <span
              className="grid min-w-[20px] place-items-center rounded-full px-[6px] text-[11px] font-bold"
              style={{ height: 20, background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {filterCount}
            </span>
          )}
        </button>
```

- [ ] **Step 2: tsc после AdSortBar**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок (проп опциональный, старые вызовы валидны).

- [ ] **Step 3: ads.index.tsx — импорты**

В `frontend/src/routes/ads.index.tsx` заменить строки импортов:
```tsx
import { type FiltersState, DEFAULT_FILTERS, AdFiltersDesktop, AdFiltersSheet } from "@/components/ads/AdFilters";
import { AdSortBar, type SortKey } from "@/components/ads/AdSortBar";
import { CategoryChips } from "@/components/ads/CategoryChips";
import { ListingCard } from "@/components/ads/ListingCard";
```
на:
```tsx
import { type FiltersState, DEFAULT_FILTERS, AdFiltersSheet } from "@/components/ads/AdFilters";
import { AdSortBar, type SortKey } from "@/components/ads/AdSortBar";
import { CategoryChips } from "@/components/ads/CategoryChips";
import { CatalogCard } from "@/components/ads/CatalogCard";
```
(Убран `AdFiltersDesktop` и `ListingCard`, добавлен `CatalogCard`.)

- [ ] **Step 4: ads.index.tsx — убрать левую панель, контент full-width**

Найти блок:
```tsx
        {/* Main layout: desktop filters sidebar + content */}
        <div className="flex gap-[20px]">
          {/* Desktop filters */}
          <AdFiltersDesktop
            value={filters}
            onChange={setFilters}
            onReset={resetFilters}
          />

          {/* Content column */}
          <div className="min-w-0 flex-1 space-y-[12px]">
            {/* Sort bar */}
            <AdSortBar
              query={q}
              onQuery={setQ}
              sort={sort}
              onSort={setSort}
              onOpenFilters={() => setSheetOpen(true)}
              count={ads.length}
            />
```
заменить на:
```tsx
        {/* Content — full width, filters live in the drawer */}
        <div className="space-y-[12px]">
          <div className="min-w-0 space-y-[12px]">
            {/* Sort bar */}
            <AdSortBar
              query={q}
              onQuery={setQ}
              sort={sort}
              onSort={setSort}
              onOpenFilters={() => setSheetOpen(true)}
              count={ads.length}
              filterCount={activeFilterCount}
            />
```
(Внешний `flex gap-[20px]` заменён на `space-y-[12px]`; внутренний `flex-1` убран; передан `filterCount={activeFilterCount}` — переменная `activeFilterCount` уже вычислена через `useMemo(() => countActiveFilters(filters), [filters])`.)

- [ ] **Step 5: ads.index.tsx — сетка скелетонов 2/3/4**

Заменить (loading-состояние):
```tsx
            {loadState === "loading" && (
              <div className="grid gap-[10px] sm:grid-cols-2">
```
на:
```tsx
            {loadState === "loading" && (
              <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4">
```

- [ ] **Step 6: ads.index.tsx — сетка данных + CatalogCard**

Заменить (data-состояние):
```tsx
            {loadState === "ok" && ads.length > 0 && (
              <div className="grid gap-[10px] sm:grid-cols-2">
                {ads.map((ad) => (
                  <ListingCard key={ad.id} ad={ad} />
                ))}
              </div>
            )}
```
на:
```tsx
            {loadState === "ok" && ads.length > 0 && (
              <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4">
                {ads.map((ad) => (
                  <CatalogCard key={ad.id} ad={ad} />
                ))}
              </div>
            )}
```

- [ ] **Step 7: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -nE "AdFiltersDesktop|ListingCard" frontend/src/routes/ads.index.tsx`
Expected: пусто (обе ссылки убраны).
Run: `grep -c "lg:grid-cols-4" frontend/src/routes/ads.index.tsx`
Expected: `2` (loading + data).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/routes/ads.index.tsx frontend/src/components/ads/AdSortBar.tsx
git commit -m "feat(catalog): filters in drawer + photo-first 2/3/4 grid"
```

---

### Task 5: Photo-flow fix — загруженное фото доходит до каталога

**Files:**
- Modify: `frontend/src/lib/api/media.ts` (`uploadMedia`)
- Modify: `frontend/src/lib/api/listings.ts` (`createListing` demo-ветка)
- Modify: `frontend/src/lib/demo-data.ts` (хранилище + `demoListingsFiltered` + `demoListing`)

**Interfaces:**
- Consumes: `categoryPlaceholder` (Task 1), `isDemoMode` из `@/lib/demo-mode`.
- Produces: `export function demoAddListing(ad: Ad): void` в `demo-data.ts` (используется `createListing`).

**Контекст:** `uploadMedia(file, purpose)` сейчас всегда бьёт `/media`. `createListing` demo хардкодит picsum и не сохраняет ad. `demoListingsFiltered(params)` фильтрует `mockAds`. `demoListing(id)` (если есть) ищет по id.

- [ ] **Step 1: media.ts — demo-ветка uploadMedia**

В `frontend/src/lib/api/media.ts` добавить импорт вверху:
```ts
import { isDemoMode } from "@/lib/demo-mode";
```
В начало тела `uploadMedia` (перед `const form = new FormData();`) добавить:
```ts
  if (isDemoMode()) {
    const url = URL.createObjectURL(file);
    return { uuid: url, url };
  }
```

- [ ] **Step 2: demo-data.ts — хранилище + добавление**

В `frontend/src/lib/demo-data.ts` добавить рядом с `demoListingsFiltered` (перед функцией):
```ts
const demoUserListings: Ad[] = [];

export function demoAddListing(ad: Ad): void {
  demoUserListings.unshift(ad);
}
```
(Тип `Ad` уже импортирован в demo-data.ts — он используется в сигнатуре `demoListingsFiltered(): Ad[]`.)

- [ ] **Step 3: demo-data.ts — подмешать созданные в фильтрацию**

В `demoListingsFiltered`, заменить первую строку тела:
```ts
  let result = mockAds;
```
на:
```ts
  let result = [...demoUserListings, ...mockAds];
```

- [ ] **Step 4: demo-data.ts — demoListing ищет и в созданных**

Функция `demoListing` (строка ~209) сейчас:
```ts
export function demoListing(id: ID): Ad | null {
  return adById(id) ?? null;
}
```
Заменить на (сначала искать в созданных, затем в базовых через `adById`):
```ts
export function demoListing(id: ID): Ad | null {
  return demoUserListings.find((a) => a.id === id) ?? adById(id) ?? null;
}
```
(`adById` уже импортирован в demo-data.ts и ищет только в `mockAds`; поэтому созданные объявления нужно искать отдельно в `demoUserListings`.)

- [ ] **Step 5: listings.ts — createListing demo берёт реальное фото + сохраняет**

В `frontend/src/lib/api/listings.ts` добавить импорты (рядом с существующими):
```ts
import { demoListings, demoListingsFiltered, demoMyListings, demoListing, demoAddListing } from "@/lib/demo-data";
import { categoryPlaceholder } from "@/lib/placeholder-image";
```
(Строка импорта из `demo-data` уже существует — добавить в неё `demoAddListing`. `categoryPlaceholder` — новый импорт.)

Заменить demo-ветку `createListing`:
```ts
  if (isDemoMode()) {
    const demoAd: Ad = {
      id: `demo-ad-${Date.now()}`,
      title: input.title,
      price: Math.round(input.priceCents / 100),
      category: "",
      subcategory: "",
      city: "Краснодар",
      image: "https://picsum.photos/seed/demo-new-ad/1200/900",
      gallery: ["https://picsum.photos/seed/demo-new-ad/1200/900"],
      description: input.description,
      delivery: input.deliveryMethods ?? [],
      status: "Продаю",
      contact: "Написать в мессенджере",
      authorId: "u1",
      views: 0,
      likes: 0,
      createdAt: "только что",
      moderation: input.publish === false ? "moderation" : "published",
    };
    return demoAd;
  }
```
на:
```ts
  if (isDemoMode()) {
    const id = `demo-ad-${Date.now()}`;
    const photos = (input.mediaIds ?? []).filter(Boolean);
    const gallery = photos.length > 0 ? photos : [categoryPlaceholder(id)];
    const demoAd: Ad = {
      id,
      title: input.title,
      price: Math.round(input.priceCents / 100),
      category: "",
      subcategory: "",
      city: "Краснодар",
      image: gallery[0],
      gallery,
      description: input.description,
      delivery: input.deliveryMethods ?? [],
      status: "Продаю",
      contact: "Написать в мессенджере",
      authorId: "u1",
      views: 0,
      likes: 0,
      createdAt: "только что",
      moderation: input.publish === false ? "moderation" : "published",
    };
    demoAddListing(demoAd);
    return demoAd;
  }
```

- [ ] **Step 6: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "demo-new-ad" frontend/src/lib/api/listings.ts`
Expected: пусто (хардкод picsum убран).
Run: `grep -n "demoAddListing" frontend/src/lib/demo-data.ts frontend/src/lib/api/listings.ts`
Expected: определение в demo-data.ts + вызов в listings.ts.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/api/media.ts frontend/src/lib/api/listings.ts frontend/src/lib/demo-data.ts
git commit -m "fix(catalog): demo photo-flow — uploaded image reaches catalog card"
```

---

### Task 6: Документация + финальный typecheck

**Files:**
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:**
- Consumes: всё вышеперечисленное.
- Produces: подтверждение чистого tsc.

- [ ] **Step 1: Добавить запись в backend-endpoints-needed.md**

В конец `frontend/docs/backend-endpoints-needed.md` добавить:

```markdown

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
```

- [ ] **Step 2: Финальный typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок (пустой вывод).

- [ ] **Step 3: Commit**

```bash
git add frontend/docs/backend-endpoints-needed.md
git commit -m "docs: note demo media→listing photo-flow, feed picsum tech-debt"
```

---

## Notes для исполнителя

- Каждый таск заканчивается зелёным `npx tsc --noEmit` (из `frontend/`).
- Vitest/RTL не настроены — не писать/запускать unit-тесты; проверка = tsc + grep + (Task 6) preview-QA.
- Task 1 (helper) должен идти первым — Task 3 и Task 5 импортируют `categoryPlaceholder`.
- Task 4 зависит от Task 3 (`CatalogCard`). Task 4 трогает `ads.index.tsx` и `AdSortBar.tsx`.
- Preview-QA каталога и прогон создания объявления с фото — на этапе финальной проверки (контроллер), не в тасках.
- Не коммитить мерж в master/neeklo без явного разрешения оператора.
