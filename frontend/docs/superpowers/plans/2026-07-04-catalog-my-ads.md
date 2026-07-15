# Catalog /ads + My Ads /my-ads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Разделить публичный каталог объявлений (`/ads`) и личный кабинет продавца (`/my-ads`), добавить категории-чипы и фильтр по городу с автодополнением.

**Architecture:** Текущий `MyAdsPage` переезжает в `routes/my-ads.tsx` без изменений. `routes/ads.index.tsx` полностью заменяется на `CatalogPage`. `fetchListings` расширяется до `CatalogParams` с клиентской фильтрацией в demo и передачей параметров в production. Поле "Город" в `AdFilters` заменяется на `CitySelect` с debounce + `searchCities()`.

**Tech Stack:** React 18, TanStack Router, TypeScript, Tailwind CSS, Framer Motion, `lucide-react`, существующие UI-компоненты проекта (`Card`, `Button`, `Badge`, `EmptyState`, `Skeleton`, `SearchInput`).

## Global Constraints

- Работать только внутри `frontend/` — backend, схема данных, auth-логика не трогаются
- Использовать существующие UI-компоненты (`components/ui/*`, `components/ui-bespoke/*`) — не создавать локальные стили
- CSS-переменные дизайн-системы: `var(--accent)`, `var(--background-elevated)`, `var(--border)`, `var(--r-card)` и др.
- После каждого таска: `cd frontend && npx tsc --noEmit` должен давать 0 ошибок
- `routeTree.gen.ts` — НЕ редактировать вручную, генерируется TanStack Router
- Не коммитить без разрешения пользователя

---

## File Map

| Файл | Действие | Ответственность |
|---|---|---|
| `src/lib/routes.ts` | Modify | Добавить `myAds`, обновить `SIDEBAR_ROUTE_MAP` |
| `src/lib/api/listings.ts` | Modify | Расширить `fetchListings` под `CatalogParams` |
| `src/lib/demo-data.ts` | Modify | `demoListings` принимает `CatalogParams` (клиентская фильтрация) |
| `src/components/ads/CitySelect.tsx` | Create | Поле города с debounce + `searchCities()` dropdown |
| `src/components/ads/AdFilters.tsx` | Modify | Заменить free-text city-input на `CitySelect`, добавить `cityId` в `FiltersState` |
| `src/components/ads/CategoryChips.tsx` | Create | Горизонтальный скролл чипов категорий |
| `src/routes/my-ads.tsx` | Create | `MyAdsPage` (перенос из `ads.index.tsx`) |
| `src/routes/ads.index.tsx` | Replace | `CatalogPage` (публичный каталог) |
| `src/components/layout/Sidebar.tsx` | Modify | Добавить пункт «Мои объявления» → `/my-ads` |

---

## Task 1: Routes infrastructure

**Files:**
- Modify: `src/lib/routes.ts`

**Interfaces:**
- Produces: `ROUTES.myAds = "/my-ads"`, секция `"my-ads"` в `SIDEBAR_ROUTE_MAP`

- [ ] **Шаг 1: Добавить `myAds` и обновить `SIDEBAR_ROUTE_MAP`**

Открыть `src/lib/routes.ts`. Внести изменения:

```ts
export const ROUTES = {
  home: "/",
  feed: "/feed",
  communities: "/communities",
  community: (id: string) => `/communities/${id}` as const,
  ads: "/ads",
  ad: (id: string) => `/ads/${id}` as const,
  adCreate: "/ads/new",
  myAds: "/my-ads",            // ← добавить
  messenger: "/messenger",
  messengerChat: (chatId: string) => `/messenger?chat=${chatId}` as const,
  profile: "/profile",
  user: (userId: string) => `/user/${userId}` as const,
  friends: "/friends",
  categories: "/categories",
  category: (id: string) => `/categories/${id}` as const,
  subcategory: (id: string, subId: string) => `/categories/${id}/${subId}` as const,
  subscription: "/subscription",
  help: "/help",
  admin: "/admin",
  channels: "/channels",
  channel: (id: string) => `/channel/${id}` as const,
  notifications: "/notifications",
} as const;

export const SIDEBAR_ROUTE_MAP: Record<string, string[]> = {
  feed: ["/feed", "/categories"],
  communities: ["/communities"],
  channels: ["/channels", "/channel"],
  ads: ["/ads"],
  "my-ads": ["/my-ads"],        // ← добавить
  messenger: ["/messenger"],
  profile: ["/profile", "/user"],
  friends: ["/friends"],
  subscription: ["/subscription"],
  help: ["/help"],
  admin: ["/admin"],
  notifications: ["/notifications"],
};
```

- [ ] **Шаг 2: Проверить типы**

```bash
cd frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок (или только ошибки из других файлов, не из `routes.ts`).

---

## Task 2: Перенести MyAdsPage в /my-ads

**Files:**
- Create: `src/routes/my-ads.tsx`
- Modify: `src/routes/ads.index.tsx` (очистить — будет заменён в Task 5)

**Interfaces:**
- Consumes: все импорты из текущего `ads.index.tsx` остаются теми же
- Produces: роут `/my-ads` с защитой `requireAuth`

- [ ] **Шаг 1: Скопировать полное содержимое `ads.index.tsx` в `my-ads.tsx`**

Прочитать `src/routes/ads.index.tsx` (весь файл). Создать `src/routes/my-ads.tsx` со следующими изменениями относительно оригинала:

1. Изменить объявление роута:
```ts
// было:
export const Route = createFileRoute("/ads/")({
  head: () => ({ meta: [{ title: "Мои объявления — МоДелизМ" }] }),
  component: MyAdsPage,
});

// стало:
export const Route = createFileRoute("/my-ads")({
  head: () => ({ meta: [{ title: "Мои объявления — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: MyAdsPage,
});
```

Всё остальное содержимое файла (импорты, типы, функции, `MyAdsPage`) — **без изменений**.

- [ ] **Шаг 2: Очистить `ads.index.tsx` до заглушки**

Файл `src/routes/ads.index.tsx` должен временно стать минимальным, чтобы TanStack Router не падал (финальная версия придёт в Task 5):

```ts
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/ads/")({
  component: () => (
    <AppLayout>
      <div />
    </AppLayout>
  ),
});
```

- [ ] **Шаг 3: Проверить типы**

```bash
cd frontend && npx tsc --noEmit
```

Ожидание: 0 новых ошибок.

---

## Task 3: Расширить fetchListings + demo-фильтрация

**Files:**
- Modify: `src/lib/api/listings.ts`
- Modify: `src/lib/demo-data.ts`

**Interfaces:**
- Produces:
```ts
export interface CatalogParams {
  q?: string;
  cityId?: number;
  cityName?: string;       // для клиентской фильтрации demo
  categoryName?: string;   // для клиентской фильтрации demo
  priceMin?: number;
  priceMax?: number;
  conditions?: string[];
  listingStatus?: string;  // "Продаю" | "Куплю" | "Обменяю"
  sort?: "new" | "cheap" | "expensive" | "popular";
  withPhotoOnly?: boolean;
}

export async function fetchListings(params?: CatalogParams): Promise<Ad[]>
```

- [ ] **Шаг 1: Добавить `CatalogParams` и обновить `fetchListings` в `listings.ts`**

В файле `src/lib/api/listings.ts` заменить:

```ts
export async function fetchListings(query?: string): Promise<Ad[]> {
  if (isDemoMode()) return demoListings(query);
  const res = await api<Paginated<ApiListing>>("/listings", {
    query: { q: query || undefined, per_page: 50 },
  });
  return (res.data ?? []).map(mapListing);
}
```

на:

```ts
export interface CatalogParams {
  q?: string;
  cityId?: number;
  cityName?: string;
  categoryName?: string;
  priceMin?: number;
  priceMax?: number;
  conditions?: string[];
  listingStatus?: string;
  sort?: "new" | "cheap" | "expensive" | "popular";
  withPhotoOnly?: boolean;
}

export async function fetchListings(params: CatalogParams = {}): Promise<Ad[]> {
  if (isDemoMode()) return demoListingsFiltered(params);
  const res = await api<Paginated<ApiListing>>("/listings", {
    query: {
      q: params.q || undefined,
      city_id: params.cityId || undefined,
      per_page: 50,
      sort: params.sort || undefined,
    },
  });
  return (res.data ?? []).map(mapListing);
}
```

Также обновить импорт в этом файле:
```ts
import { demoListings, demoListingsFiltered, demoMyListings, demoListing } from "@/lib/demo-data";
```

- [ ] **Шаг 2: Добавить `demoListingsFiltered` в `demo-data.ts`**

В файле `src/lib/demo-data.ts` добавить после существующей функции `demoListings`:

```ts
import type { CatalogParams } from "@/lib/api/listings";

export function demoListingsFiltered(params: CatalogParams): Ad[] {
  let result = mockAds;

  if (params.q) {
    const q = params.q.toLowerCase();
    result = result.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }

  if (params.categoryName && params.categoryName !== "Все") {
    result = result.filter((a) => a.category === params.categoryName);
  }

  if (params.cityName) {
    const city = params.cityName.toLowerCase();
    result = result.filter((a) => a.city.toLowerCase().includes(city));
  }

  if (params.priceMin) {
    result = result.filter((a) => a.price >= params.priceMin!);
  }

  if (params.priceMax && params.priceMax < 100000) {
    result = result.filter((a) => a.price <= params.priceMax!);
  }

  if (params.conditions && params.conditions.length > 0) {
    result = result.filter((a) => a.condition && params.conditions!.includes(a.condition));
  }

  if (params.listingStatus && params.listingStatus !== "Все") {
    result = result.filter((a) => a.status === params.listingStatus);
  }

  if (params.withPhotoOnly) {
    result = result.filter((a) => a.image || (a.gallery && a.gallery.length > 0));
  }

  if (params.sort === "cheap") result = [...result].sort((a, b) => a.price - b.price);
  else if (params.sort === "expensive") result = [...result].sort((a, b) => b.price - a.price);
  else if (params.sort === "popular") result = [...result].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  // "new" — порядок по умолчанию (mockAds уже отсортированы от новых)

  return result;
}
```

**Важно:** `CatalogParams` импортируется из `@/lib/api/listings`. Чтобы избежать циклического импорта, перенести интерфейс `CatalogParams` в `@/lib/api/listings.ts` (уже сделано в шаге 1) и в `demo-data.ts` импортировать именно оттуда.

- [ ] **Шаг 3: Найти и обновить все вызовы `fetchListings(query)` в проекте**

Найти все места, где используется `fetchListings`:

```bash
grep -rn "fetchListings" frontend/src --include="*.tsx" --include="*.ts"
```

Текущие места вызова:
- `routes/ads.$id.tsx:50` — `fetchListings()` для похожих объявлений → оставить `fetchListings()` без параметров (пустой объект по умолчанию)
- `routes/categories.$id.$subId.tsx:217` — `fetchListings()` → оставить без параметров

Оба вызова работают с новой сигнатурой без изменений (default param `{}`).

- [ ] **Шаг 4: Проверить типы**

```bash
cd frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

---

## Task 4: CitySelect компонент + обновление AdFilters

**Files:**
- Create: `src/components/ads/CitySelect.tsx`
- Modify: `src/components/ads/AdFilters.tsx`

**Interfaces:**
- Produces:
```ts
// CitySelect.tsx
interface CitySelectProps {
  value: string;           // отображаемое название города
  cityId?: number;         // id для API
  onChange: (name: string, id?: number) => void;
  placeholder?: string;
}
export function CitySelect(props: CitySelectProps): JSX.Element

// AdFilters.tsx — обновлённый FiltersState
export interface FiltersState {
  category: string;
  subcategory: string;
  status: string;
  city: string;
  cityId?: number;        // ← новое поле
  conditions: AdCondition[];
  deliveries: string[];
  priceMin: number;
  priceMax: number;
  withPhotoOnly: boolean;
}

export const DEFAULT_FILTERS: FiltersState  // обновлённый с cityId: undefined
```

- [ ] **Шаг 1: Создать `CitySelect.tsx`**

Создать файл `src/components/ads/CitySelect.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { searchCities, type City } from "@/lib/api/cities";

interface CitySelectProps {
  value: string;
  cityId?: number;
  onChange: (name: string, id?: number) => void;
  placeholder?: string;
}

export function CitySelect({ value, onChange, placeholder = "Любой город" }: CitySelectProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // sync external value reset (e.g. "Сбросить фильтры")
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleInput(v: string) {
    setQuery(v);
    onChange(v, undefined); // сбросить cityId пока пользователь печатает
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!v.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const cities = await searchCities(v);
        setResults(cities.slice(0, 8));
        setOpen(cities.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function pick(city: City) {
    setQuery(city.name);
    onChange(city.name, city.id);
    setOpen(false);
    setResults([]);
  }

  function clear() {
    setQuery("");
    onChange("", undefined);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-[8px]"
        style={{
          background: "var(--background-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-input)",
          height: 40,
          padding: "0 10px",
        }}
      >
        <MapPin size={14} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[13px] outline-none"
          style={{ color: "var(--foreground)" }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
        />
        {loading && <Loader2 size={14} className="animate-spin shrink-0" style={{ color: "var(--foreground-50)" }} />}
        {query && !loading && (
          <button type="button" onClick={clear} aria-label="Сбросить город"
            className="grid shrink-0 place-items-center"
            style={{ color: "var(--foreground-50)" }}>
            <X size={14} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute left-0 right-0 top-[44px] z-50 overflow-hidden py-[4px]"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-modal)",
          }}
        >
          {results.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => pick(city)}
              className="flex w-full items-center gap-[8px] px-[12px] py-[9px] text-left text-[13px] transition-colors hover:bg-[color:var(--background-surface-hover)]"
              style={{ color: "var(--foreground)" }}
            >
              <MapPin size={12} style={{ color: "var(--foreground-50)", flexShrink: 0 }} />
              <span className="flex-1">{city.name}</span>
              {city.region && (
                <span className="text-[11px]" style={{ color: "var(--foreground-50)" }}>{city.region}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Шаг 2: Обновить `FiltersState` и `DEFAULT_FILTERS` в `AdFilters.tsx`**

В `src/components/ads/AdFilters.tsx` добавить `cityId?: number` в интерфейс:

```ts
export interface FiltersState {
  category: string;
  subcategory: string;
  status: string;
  city: string;
  cityId?: number;           // ← добавить
  conditions: AdCondition[];
  deliveries: string[];
  priceMin: number;
  priceMax: number;
  withPhotoOnly: boolean;
}

export const DEFAULT_FILTERS: FiltersState = {
  category: "Все",
  subcategory: "Все",
  status: "Все",
  city: "",
  cityId: undefined,         // ← добавить
  conditions: [],
  deliveries: [],
  priceMin: 0,
  priceMax: 100000,
  withPhotoOnly: false,
};
```

- [ ] **Шаг 3: Заменить city-input на `CitySelect` в `AdFilters.tsx`**

В том же файле:

1. Добавить импорт вверху:
```ts
import { CitySelect } from "@/components/ads/CitySelect";
```

2. Найти блок `<Group title="Город">` и заменить на:
```tsx
<Group title="Город">
  <CitySelect
    value={value.city}
    cityId={value.cityId}
    onChange={(name, id) => onChange({ ...value, city: name, cityId: id })}
    placeholder="Любой город"
  />
</Group>
```

- [ ] **Шаг 4: Проверить типы**

```bash
cd frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

---

## Task 5: CategoryChips компонент

**Files:**
- Create: `src/components/ads/CategoryChips.tsx`

**Interfaces:**
- Produces:
```ts
interface CategoryChipsProps {
  value: string;              // выбранная категория ("Все" | category.name)
  onChange: (name: string) => void;
}
export function CategoryChips(props: CategoryChipsProps): JSX.Element
```

- [ ] **Шаг 1: Создать `CategoryChips.tsx`**

```tsx
import * as Icons from "lucide-react";
import { useListingCategories } from "@/lib/hooks/useCategories";
import type { Category } from "@/lib/mock";

function CategoryIcon({ name }: { name: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[name] ??
    Icons.Tag;
  return <Icon size={15} />;
}

interface CategoryChipsProps {
  value: string;
  onChange: (name: string) => void;
}

export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  const categories = useListingCategories();

  const all = [
    { id: "all", name: "Все", icon: "LayoutGrid" } as Pick<Category, "id" | "name" | "icon">,
    ...categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
  ];

  return (
    <div
      className="flex gap-[8px] overflow-x-auto pb-[4px]"
      style={{ scrollbarWidth: "none" }}
    >
      {all.map((cat) => {
        const active = value === cat.name;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.name)}
            className="inline-flex shrink-0 items-center gap-[6px] whitespace-nowrap text-[12.5px] font-medium transition-all"
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: "var(--r-pill)",
              background: active ? "var(--accent)" : "var(--background-elevated)",
              color: active ? "var(--accent-foreground)" : "var(--foreground-70)",
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              boxShadow: active ? "0 1px 6px color-mix(in oklab,var(--accent) 25%,transparent)" : "none",
            }}
          >
            <CategoryIcon name={cat.icon} />
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Шаг 2: Проверить типы**

```bash
cd frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

---

## Task 6: CatalogPage — основная страница

**Files:**
- Replace: `src/routes/ads.index.tsx`

**Interfaces:**
- Consumes:
  - `fetchListings(params: CatalogParams): Promise<Ad[]>` (Task 3)
  - `CategoryChips` (Task 5)
  - `AdFilters.FiltersState`, `DEFAULT_FILTERS`, `AdFiltersDesktop`, `AdFiltersSheet` (Task 4)
  - `CitySelect` (Task 4)
  - `AdSortBar` (existing: `src/components/ads/AdSortBar.tsx`)
  - `ListingCard` (existing: `src/components/ads/ListingCard.tsx`)
  - `AdCardSkeleton` (existing: `src/components/ads/AdCardSkeleton.tsx`)
  - `ROUTES` (Task 1)
  - `getToken` из `@/lib/api/client` — для определения авторизации

- [ ] **Шаг 1: Написать `CatalogPage`**

Полностью заменить содержимое `src/routes/ads.index.tsx`:

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, SlidersHorizontal, X, RotateCcw, AlertCircle, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchListings, type CatalogParams } from "@/lib/api/listings";
import { type FiltersState, DEFAULT_FILTERS, AdFiltersDesktop, AdFiltersSheet } from "@/components/ads/AdFilters";
import { AdSortBar, type SortKey, type ViewMode } from "@/components/ads/AdSortBar";
import { CategoryChips } from "@/components/ads/CategoryChips";
import { ListingCard } from "@/components/ads/ListingCard";
import { AdCardSkeleton } from "@/components/ads/AdCardSkeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { getToken } from "@/lib/api/client";
import type { Ad } from "@/lib/mock";

export const Route = createFileRoute("/ads/")({
  head: () => ({
    meta: [
      { title: "Объявления — МоДелизМ" },
      { name: "description", content: "Каталог объявлений: RC авто, самолёты, квадрокоптеры, корабли. Купить и продать модели и запчасти." },
    ],
  }),
  component: CatalogPage,
});

type LoadState = "idle" | "loading" | "ok" | "error";

function countActiveFilters(f: FiltersState): number {
  let n = 0;
  if (f.category !== "Все") n++;
  if (f.city) n++;
  if (f.status !== "Все") n++;
  if (f.conditions.length) n++;
  if (f.priceMin > 0) n++;
  if (f.priceMax < 100000) n++;
  if (f.withPhotoOnly) n++;
  return n;
}

function buildParams(
  q: string,
  filters: FiltersState,
  sort: SortKey,
): CatalogParams {
  return {
    q: q || undefined,
    cityId: filters.cityId,
    cityName: filters.city || undefined,
    categoryName: filters.category !== "Все" ? filters.category : undefined,
    priceMin: filters.priceMin > 0 ? filters.priceMin : undefined,
    priceMax: filters.priceMax < 100000 ? filters.priceMax : undefined,
    conditions: filters.conditions.length ? filters.conditions : undefined,
    listingStatus: filters.status !== "Все" ? filters.status : undefined,
    withPhotoOnly: filters.withPhotoOnly || undefined,
    sort,
  };
}

function CatalogPage() {
  const navigate = useNavigate();
  const isAuthed = !!getToken();

  const [ads, setAds] = useState<Ad[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [view, setView] = useState<ViewMode>("grid");
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const params = buildParams(q, filters, sort);
      const result = await fetchListings(params);
      setAds(result);
      setLoadState("ok");
    } catch {
      setLoadState("error");
    }
  }, [q, filters, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setQ("");
    setSort("new");
  }

  function handleCategoryChip(name: string) {
    setFilters((prev) => ({ ...prev, category: name, subcategory: "Все" }));
  }

  const hasAnyFilter = activeFilterCount > 0 || q;

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[16px] pb-[24px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <h1
              className="font-display text-[22px] font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              Объявления
            </h1>
            <p className="mt-[1px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              Покупайте и продавайте технику для моделизма
            </p>
          </div>
          {isAuthed ? (
            <Link
              to={ROUTES.adCreate}
              className="inline-flex shrink-0 items-center gap-[6px] text-[13px] font-semibold"
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: "var(--r-button)",
                background: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              <Plus size={15} /> Разместить
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex shrink-0 items-center gap-[6px] text-[13px] font-semibold"
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: "var(--r-button)",
                background: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              <Plus size={15} /> Разместить
            </Link>
          )}
        </div>

        {/* Category chips */}
        <CategoryChips
          value={filters.category}
          onChange={handleCategoryChip}
        />

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
              view={view}
              onView={setView}
              onOpenFilters={() => setSheetOpen(true)}
              count={ads.length}
            />

            {/* Active filter tags */}
            {hasAnyFilter && (
              <div className="flex flex-wrap gap-[6px]">
                {q && (
                  <FilterTag label={`«${q}»`} onRemove={() => setQ("")} />
                )}
                {filters.category !== "Все" && (
                  <FilterTag
                    label={filters.category}
                    onRemove={() => setFilters((p) => ({ ...p, category: "Все", subcategory: "Все" }))}
                  />
                )}
                {filters.city && (
                  <FilterTag
                    label={filters.city}
                    onRemove={() => setFilters((p) => ({ ...p, city: "", cityId: undefined }))}
                  />
                )}
                {filters.status !== "Все" && (
                  <FilterTag
                    label={filters.status}
                    onRemove={() => setFilters((p) => ({ ...p, status: "Все" }))}
                  />
                )}
                {filters.conditions.map((c) => (
                  <FilterTag
                    key={c}
                    label={c}
                    onRemove={() =>
                      setFilters((p) => ({ ...p, conditions: p.conditions.filter((x) => x !== c) }))
                    }
                  />
                ))}
                {(activeFilterCount > 1 || (activeFilterCount === 1 && q)) && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-[4px] text-[11.5px] font-medium transition-colors"
                    style={{ color: "var(--accent)", padding: "0 4px" }}
                  >
                    <RotateCcw size={11} /> Сбросить всё
                  </button>
                )}
              </div>
            )}

            {/* States */}
            {loadState === "loading" && (
              <div className={view === "grid"
                ? "grid gap-[10px] sm:grid-cols-2"
                : "flex flex-col gap-[10px]"
              }>
                {Array.from({ length: 6 }).map((_, i) => (
                  <AdCardSkeleton key={i} />
                ))}
              </div>
            )}

            {loadState === "error" && (
              <div
                className="flex flex-col items-center gap-[12px] rounded-[var(--r-card)] border py-[48px] text-center"
                style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
              >
                <AlertCircle size={32} style={{ color: "var(--error)" }} />
                <p className="text-[14px]" style={{ color: "var(--foreground-70)" }}>
                  Не удалось загрузить объявления
                </p>
                <Button variant="outline" onClick={() => void load()}>
                  <RefreshCw size={14} className="mr-[6px]" /> Повторить
                </Button>
              </div>
            )}

            {loadState === "ok" && ads.length === 0 && (
              <EmptyState
                icon="Megaphone"
                title={hasAnyFilter ? "Ничего не найдено" : "Объявлений пока нет"}
                description={
                  hasAnyFilter
                    ? "Попробуйте изменить фильтры или поисковый запрос"
                    : "Станьте первым — разместите объявление"
                }
                action={
                  hasAnyFilter ? (
                    <Button variant="outline" onClick={resetFilters}>
                      <RotateCcw size={14} className="mr-[6px]" /> Сбросить фильтры
                    </Button>
                  ) : isAuthed ? (
                    <Button onClick={() => navigate({ to: ROUTES.adCreate })}>
                      <Plus size={14} className="mr-[6px]" /> Разместить объявление
                    </Button>
                  ) : (
                    <Button onClick={() => navigate({ to: "/login" })}>
                      Войти и разместить
                    </Button>
                  )
                }
              />
            )}

            {loadState === "ok" && ads.length > 0 && (
              <div className={view === "grid"
                ? "grid gap-[10px] sm:grid-cols-2"
                : "flex flex-col gap-[10px]"
              }>
                {ads.map((ad) => (
                  <ListingCard key={ad.id} ad={ad} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile filter sheet */}
        <AdFiltersSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          value={filters}
          onChange={setFilters}
          onReset={() => { resetFilters(); setSheetOpen(false); }}
        />
      </div>
    </AppLayout>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-[4px] text-[12px] font-medium"
      style={{
        height: 26,
        padding: "0 8px 0 10px",
        borderRadius: "var(--r-pill)",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        border: "1px solid var(--border-accent)",
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Убрать фильтр ${label}`}
        className="grid place-items-center rounded-full transition-colors hover:bg-[color:var(--accent)]"
        style={{ width: 16, height: 16, color: "inherit" }}
      >
        <X size={10} />
      </button>
    </span>
  );
}
```

- [ ] **Шаг 2: Проверить типы**

```bash
cd frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

---

## Task 7: Обновить Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `ROUTES.myAds` (Task 1), `selectors.currentUser` (existing store)

- [ ] **Шаг 1: Добавить импорты и пункт «Мои объявления» в Sidebar**

В `src/components/layout/Sidebar.tsx`:

1. Добавить `ClipboardList` в импорт из `lucide-react`:
```ts
import { Newspaper, Users2, Radio, MessageSquare, Megaphone, UserPlus, User, ShoppingBag, HelpCircle, Crown, ExternalLink, Bell, ClipboardList } from "lucide-react";
```

2. Добавить `selectors` в импорт из store:
```ts
import { useStore, selectors } from "@/lib/store";
```

3. Обновить тип `Item` — добавить `/my-ads` в union:
```ts
interface Item {
  to: "/feed" | "/communities" | "/channels" | "/messenger" | "/ads" | "/friends" | "/notifications" | "/profile" | "/subscription" | "/help" | "/my-ads";
  labelKey: string;
  icon: typeof Newspaper;
  section: string;
}
```

4. Добавить пункт «Мои объявления» после «Объявления» в массиве `items`:
```ts
const items: Item[] = [
  { to: ROUTES.feed,          labelKey: "nav.feed",          icon: Newspaper,    section: "feed" },
  { to: ROUTES.communities,   labelKey: "nav.communities",   icon: Users2,       section: "communities" },
  { to: ROUTES.channels,      labelKey: "nav.channels",      icon: Radio,        section: "channels" },
  { to: ROUTES.messenger,     labelKey: "nav.messenger",     icon: MessageSquare, section: "messenger" },
  { to: ROUTES.ads,           labelKey: "nav.ads",           icon: Megaphone,    section: "ads" },
  // nav.myAds добавляется условно ниже — только для авторизованных
  { to: ROUTES.friends,       labelKey: "nav.friends",       icon: UserPlus,     section: "friends" },
  { to: ROUTES.notifications, labelKey: "nav.notifications", icon: Bell,         section: "notifications" },
  { to: ROUTES.profile,       labelKey: "nav.profile",       icon: User,         section: "profile" },
  { to: ROUTES.subscription,  labelKey: "nav.subscription",  icon: Crown,        section: "subscription" },
  { to: ROUTES.help,          labelKey: "nav.help",          icon: HelpCircle,   section: "help" },
];
```

5. В компоненте `Sidebar` получить текущего пользователя и вставить conditionally-rendered элемент после пункта «Объявления»:

```tsx
export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  const unread = useUnreadNotifications();
  const me = useStore(selectors.currentUser);   // ← добавить
  const { t } = useTranslation();

  return (
    <aside className="hidden lg:block w-60 shrink-0">
      <div className="h-full space-y-1 overflow-y-auto overflow-x-hidden py-4" style={{ scrollbarWidth: "none" }}>
        {/* ... шапка без изменений ... */}
        <nav className="space-y-0.5">
          {items.map(({ to, labelKey, icon: Icon, section }) => {
            const active = activeSection === section;
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
                style={
                  active
                    ? {
                        borderLeft: "3px solid var(--accent)",
                        paddingLeft: 9,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                      }
                    : undefined
                }
              >
                <Icon className="h-5 w-5" />
                {t(labelKey)}
                {section === "notifications" && unread > 0 && (
                  <span
                    className="ml-auto grid min-w-[18px] place-items-center rounded-full px-[5px] text-[10px] font-bold text-[var(--accent-foreground)]"
                    style={{ height: 18, background: "var(--accent)" }}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Мои объявления — только для авторизованных */}
          {me && (
            <Link
              to={ROUTES.myAds}
              className={`relative flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors ${
                activeSection === "my-ads"
                  ? "bg-accent/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted"
              }`}
              style={
                activeSection === "my-ads"
                  ? {
                      borderLeft: "3px solid var(--accent)",
                      paddingLeft: 9,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                    }
                  : undefined
              }
            >
              <ClipboardList className="h-5 w-5" />
              {t("nav.myAds")}
            </Link>
          )}

          {/* Внешняя ссылка Магазин */}
          <a href="https://modelizm23.ru" target="_blank" rel="noreferrer" /* ... без изменений ... */ />
        </nav>
        {/* ... остаток Sidebar без изменений ... */}
      </div>
    </aside>
  );
}
```

- [ ] **Шаг 2: Добавить перевод `nav.myAds` в локали**

Открыть `src/lib/i18n/locales/ru.ts` (или файл с русскими переводами), найти объект `nav` и добавить:
```ts
nav: {
  // ... существующие ключи ...
  myAds: "Мои объявления",
},
```

Повторить для `en.ts`:
```ts
nav: {
  myAds: "My Listings",
},
```

Повторить для `zh.ts`:
```ts
nav: {
  myAds: "我的广告",
},
```

- [ ] **Шаг 3: Проверить типы**

```bash
cd frontend && npx tsc --noEmit
```

Ожидание: 0 ошибок.

---

## Task 8: Обновить backend-endpoints-needed.md

**Files:**
- Modify: `frontend/docs/backend-endpoints-needed.md`

- [ ] **Обновить секцию #1 в документе**

Открыть `frontend/docs/backend-endpoints-needed.md`, найти секцию «1. Публичный каталог объявлений с фильтрами» и расширить:

```markdown
## 1. Публичный каталог объявлений с фильтрами

**Задача:** #18, #19, #21 + реализовано в CatalogPage (2026-07-04)
**Endpoint:** `GET /listings`
**Метод:** GET
**Query params:**
| Параметр | Тип | Описание |
|---|---|---|
| q | string? | Текстовый поиск |
| city_id | number? | Фильтр по городу |
| per_page | number? | Размер страницы |
| sort | "new"/"price_asc"/"price_desc"/"popular"? | Сортировка |

**Что нужно добавить к существующему `/listings`:**
- `city_id` — фильтр по городу (объект `city.id` в модели Listing)
- `sort=price_asc` и `sort=price_desc` — сортировка по цене
- `sort=popular` — сортировка по просмотрам

**Текущий статус:** Frontend реализован с client-side фильтрацией в demo-режиме.
В production `city_id` и `sort` передаются в query, но бэкенд их не обрабатывает.

**Demo/mock fallback:** `demoListingsFiltered()` в `src/lib/demo-data.ts` — полная клиентская фильтрация.
```

---

## Task 9: Финальная проверка и QA

**Files:** все изменённые

- [ ] **Шаг 1: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Ожидание: `Found 0 errors.`

- [ ] **Шаг 2: Проверить маршруты через grep**

```bash
grep -rn "to=\"/ads\"" frontend/src --include="*.tsx" | grep -v "ads/\$id\|ads/new\|ads/my"
```

Все ссылки `to="/ads"` должны вести в каталог (это теперь правильно).

```bash
grep -rn "/my-ads" frontend/src --include="*.tsx"
```

Должны быть: `routes/my-ads.tsx`, `Sidebar.tsx`, `lib/routes.ts`.

- [ ] **Шаг 3: QA-таблица — ручная проверка**

| Сценарий | Шаги | Ожидаемый результат |
|---|---|---|
| Гость → каталог | Открыть `/ads` без авторизации | Виден каталог объявлений, категории-чипы наверху |
| Гость → фильтр по городу | `/ads` → в поле «Город» ввести «Краснодар» | Dropdown с городами, после выбора — тег «Краснодар» над сеткой |
| Гость → фильтр по категории | Кликнуть чип «Автомодели» | Сетка обновляется, показывает только автомодели |
| Гость → сброс фильтров | Применить фильтры → «Сбросить всё» | Все фильтры снимаются, каталог полный |
| Гость → карточка | Кликнуть на объявление | Открывается `/ads/$id` |
| Гость → «Разместить» | Кнопка «Разместить» → клик | Редирект на `/login` |
| Авторизован → «Мои объявления» | Sidebar → «Мои объявления» | Открывается `/my-ads`, не каталог |
| Авторизован → «Объявления» | Sidebar → «Объявления» | Открывается `/ads` — каталог |
| Landing CTA | `/` → «Смотреть объявления» | Открывается `/ads` — каталог |
| Mobile 390px | `/ads` на 390px | Нет horizontal scroll, category chips скроллятся горизонтально |
| Desktop 1440px | `/ads` на 1440px | Левая панель фильтров видна, grid 2 колонки |
| State: loading | `/ads` при медленной сети | Skeleton 6 карточек |
| State: empty+filter | Фильтр дающий 0 результатов | «Ничего не найдено» + «Сбросить фильтры» |
| State: error | Эмулировать 500 (demo: невозможно — проверить `loadState="error"` через DevTools) | Alert + кнопка «Повторить» |
| `/my-ads` без auth | Открыть в новой вкладке без входа | Редирект на `/login` |
