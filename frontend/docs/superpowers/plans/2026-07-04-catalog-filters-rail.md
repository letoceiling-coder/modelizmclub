# Catalog Filters Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На /ads (xl+) заменить drawer-фильтры на persistent-панель со схлопнутым в иконки app-sidebar, починить обрезку category-chips (fade+scroll) и добавить breadcrumb Каталог › Категория › Подкатегория над заголовком.

**Architecture:** Всё на брейкпоинте xl (1280). Sidebar получает проп `collapsed` (иконочный рейл на xl+); AppLayout прокидывает `navCollapsed`; новый `AdFiltersPanel` (persistent, xl+) и `CatalogBreadcrumb`; `ads.index` собирает `[panel][grid]`; кнопка «Фильтры» скрыта на xl+. <xl — как сейчас (полный sidebar + drawer).

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind v4, lucide-react, react-i18next.

## Global Constraints

- Работать строго внутри `frontend/`. Не трогать backend, routes, auth, содержательные поля фильтров (`Body` в AdFilters.tsx).
- Mobile-брейкпоинты (360-430) и mobile-компоненты — не трогать. Collapse только на /ads; прочие страницы — полный sidebar без изменений.
- Брейкпоинт persistent-панели/collapse — `xl` (1280). <xl — текущее поведение (drawer + полный sidebar).
- Иконочный sidebar: `w-16`, нативные `title`-тултипы, только nav-иконки + иконка маркета; блок подписки и `FeedbackDialog` в icon-режиме скрыты (`FeedbackDialog` не модифицировать).
- Breadcrumb корень = «Каталог» (клик → сброс категории до «Все», остаёмся на /ads); уровни только для выбранных; без пустых `›`.
- Кнопка «Фильтры» в sort-bar — `xl:hidden`.
- Использовать существующие дизайн-токены; без локальных цветов.
- TypeScript strict, без `any`. После изменений `npx tsc --noEmit` (из `frontend/`) чистый.
- Нет unit-тест-раннера — «тест» = `npx tsc --noEmit` + grep. Preview-QA (1280/1440/1600 + <1280 + mobile) — работа контроллера после тасков.
- Не коммитить мерж без явного разрешения; коммиты по таскам разрешены.

---

### Task 1: CategoryChips — fade + scroll affordance

**Files:**
- Modify: `frontend/src/components/ads/CategoryChips.tsx`

**Interfaces:**
- Consumes: `useListingCategories()` (существует). Пропы `{ value, onChange }` не меняются.
- Produces: нет новых экспортов.

**Контекст:** Текущий скролл-контейнер `<div className="flex gap-[8px] overflow-x-auto pb-[4px]" style={{ scrollbarWidth: "none" }}>` без fade. Нужно обернуть в relative-обёртку и добавить fade-оверлеи по краям, управляемые состоянием скролла.

- [ ] **Step 1: Заменить компонент**

Заменить всё содержимое `frontend/src/components/ads/CategoryChips.tsx` на:

```tsx
import { useEffect, useRef, useState } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };

  useEffect(() => {
    updateEdges();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [categories.length]);

  const all = [
    { id: "all", name: "Все", icon: "LayoutGrid" } as Pick<Category, "id" | "name" | "icon">,
    ...categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
  ];

  return (
    <div className="relative">
      {/* left fade */}
      {!atStart && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[32px]"
          style={{ background: "linear-gradient(to right, var(--background), transparent)" }}
        />
      )}
      {/* right fade */}
      {!atEnd && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[32px]"
          style={{ background: "linear-gradient(to left, var(--background), transparent)" }}
        />
      )}
      <div
        ref={scrollRef}
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
    </div>
  );
}
```

- [ ] **Step 2: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -c "atStart\|atEnd\|linear-gradient" frontend/src/components/ads/CategoryChips.tsx`
Expected: ненулевое (fade-логика на месте).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ads/CategoryChips.tsx
git commit -m "feat(catalog): category chips edge fade + scroll affordance"
```

---

### Task 2: `CatalogBreadcrumb` — хлебные крошки (new)

**Files:**
- Create: `frontend/src/components/ads/CatalogBreadcrumb.tsx`

**Interfaces:**
- Produces: `export function CatalogBreadcrumb({ category, subcategory, onResetToRoot, onResetToCategory }: { category: string; subcategory: string; onResetToRoot: () => void; onResetToCategory: () => void }): JSX.Element`. Используется в Task 6 (ads.index).

**Контекст:** `filters.category`/`filters.subcategory` — строки, «Все» = не выбрано. Крошки: Каталог › Категория › Подкатегория, только для выбранных уровней; клики сбрасывают до уровня.

- [ ] **Step 1: Проверить, что файла нет**

Run: `ls frontend/src/components/ads/CatalogBreadcrumb.tsx 2>&1`
Expected: `No such file or directory`.

- [ ] **Step 2: Создать компонент**

Создать `frontend/src/components/ads/CatalogBreadcrumb.tsx`:

```tsx
import { ChevronRight } from "lucide-react";

interface Props {
  category: string;
  subcategory: string;
  onResetToRoot: () => void;
  onResetToCategory: () => void;
}

export function CatalogBreadcrumb({ category, subcategory, onResetToRoot, onResetToCategory }: Props) {
  const hasCategory = category !== "Все";
  const hasSubcategory = hasCategory && subcategory !== "Все";

  const sep = (
    <ChevronRight size={13} className="shrink-0" style={{ color: "var(--foreground-30)" }} />
  );

  return (
    <nav className="flex items-center gap-[6px] text-[12px]" aria-label="Хлебные крошки">
      {/* root */}
      {hasCategory ? (
        <button
          type="button"
          onClick={onResetToRoot}
          className="transition-colors hover:underline"
          style={{ color: "var(--foreground-50)" }}
        >
          Каталог
        </button>
      ) : (
        <span style={{ color: "var(--foreground-50)" }}>Каталог</span>
      )}

      {/* category level */}
      {hasCategory && (
        <>
          {sep}
          {hasSubcategory ? (
            <button
              type="button"
              onClick={onResetToCategory}
              className="transition-colors hover:underline"
              style={{ color: "var(--foreground-50)" }}
            >
              {category}
            </button>
          ) : (
            <span className="font-medium" style={{ color: "var(--foreground-70)" }}>{category}</span>
          )}
        </>
      )}

      {/* subcategory level */}
      {hasSubcategory && (
        <>
          {sep}
          <span className="font-medium" style={{ color: "var(--foreground-70)" }}>{subcategory}</span>
        </>
      )}
    </nav>
  );
}
```

- [ ] **Step 3: Проверка tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ads/CatalogBreadcrumb.tsx
git commit -m "feat(catalog): CatalogBreadcrumb (Каталог › Категория › Подкатегория)"
```

---

### Task 3: `AdFiltersPanel` — persistent-панель (AdFilters.tsx)

**Files:**
- Modify: `frontend/src/components/ads/AdFilters.tsx` (добавить экспорт после `AdFiltersSheet`)

**Interfaces:**
- Consumes: приватный `Body` и `Props` (`{ value, onChange, onReset }`) — уже в файле.
- Produces: `export function AdFiltersPanel(props: Props)` — persistent-панель `hidden xl:block`. Используется в Task 6.

**Контекст:** `AdFilters.tsx` содержит приватный `Body({ value, onChange, onReset }: Props)` (все поля фильтров) и `export function AdFiltersSheet(...)`. Нужно добавить persistent-обёртку вокруг `Body`, sticky, только xl+.

- [ ] **Step 1: Добавить экспорт AdFiltersPanel**

В `frontend/src/components/ads/AdFilters.tsx`, в конец файла (после закрывающей `}` компонента `AdFiltersSheet`) добавить:

```tsx

export function AdFiltersPanel(props: Props) {
  return (
    <aside className="hidden xl:block w-[280px] shrink-0">
      <div
        className="sticky top-0 overflow-y-auto pr-[4px]"
        style={{ maxHeight: "calc(100vh - var(--desktop-topbar-h) - 32px)", scrollbarWidth: "thin" }}
      >
        <h3 className="mb-[12px] font-display text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
          Фильтры
        </h3>
        <Body {...props} />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "export function AdFiltersPanel" frontend/src/components/ads/AdFilters.tsx`
Expected: одно совпадение.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ads/AdFilters.tsx
git commit -m "feat(catalog): AdFiltersPanel persistent desktop filter panel (xl+)"
```

---

### Task 4: `Sidebar` — иконочный вариант по пропу `collapsed`

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: существующие `items`, `getActiveSection`, `useRouterState`, `selectors`, i18n, `ShoppingBag`.
- Produces: `Sidebar({ collapsed }: { collapsed?: boolean })`. Task 5 (AppLayout) передаёт `collapsed`.

**Контекст:** Текущий `Sidebar()` рендерит `<aside className="hidden lg:block w-60 shrink-0">` с полным контентом (nav + market + подписка + FeedbackDialog). Нужно: проп `collapsed`; при `false` — как сейчас; при `true` — на lg–xl полный, на xl+ иконочный рейл (nav-иконки + маркет-иконка; подписка/фидбэк скрыты).

- [ ] **Step 1: Заменить компонент**

Заменить функцию `Sidebar` (строки 27-97) на:

```tsx
export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  const me = useStore(selectors.currentUser);
  const { t } = useTranslation();
  const isGuest = me.id === "guest";

  const fullInner = (
    <div className="h-full space-y-1 overflow-y-auto overflow-x-hidden py-4" style={{ scrollbarWidth: "none" }}>
      <nav className="space-y-0.5">
        {items.map(({ to, labelKey, icon: Icon, section, authOnly }) => {
          if (authOnly && isGuest) return null;
          const active = activeSection === section;
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors ${
                active ? "bg-accent/10 text-primary font-medium" : "text-foreground hover:bg-muted"
              }`}
              style={
                active
                  ? { borderLeft: "3px solid var(--accent)", paddingLeft: 9, background: "var(--accent-soft)", color: "var(--accent)" }
                  : undefined
              }
            >
              <Icon className="h-5 w-5" />
              {t(labelKey)}
            </Link>
          );
        })}
        <a
          href="https://modelizm23.ru"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5" />
            {t("nav.market")}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
      </nav>

      <Link
        to={ROUTES.subscription}
        className="mt-4 flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs transition-colors hover:bg-muted"
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--success, #22c55e)" }} />
        <span className="font-medium" style={{ color: "var(--foreground-70)" }}>{t("common.subscriptionActive")}</span>
      </Link>

      <div className="mt-2">
        <FeedbackDialog />
      </div>
    </div>
  );

  if (!collapsed) {
    return (
      <aside className="hidden lg:block w-60 shrink-0">{fullInner}</aside>
    );
  }

  // collapsed (/ads): full on lg–xl, icon rail on xl+
  return (
    <>
      <aside className="hidden lg:block xl:hidden w-60 shrink-0">{fullInner}</aside>
      <aside className="hidden xl:flex w-16 shrink-0 flex-col">
        <nav className="flex flex-col items-center gap-1 py-4">
          {items.map(({ to, labelKey, icon: Icon, section, authOnly }) => {
            if (authOnly && isGuest) return null;
            const active = activeSection === section;
            return (
              <Link
                key={to}
                to={to}
                title={t(labelKey)}
                aria-label={t(labelKey)}
                className="grid h-10 w-10 place-items-center rounded-lg transition-colors hover:bg-muted"
                style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--foreground-70)" }}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
          <a
            href="https://modelizm23.ru"
            target="_blank"
            rel="noreferrer"
            title={t("nav.market")}
            aria-label={t("nav.market")}
            className="grid h-10 w-10 place-items-center rounded-lg transition-colors hover:bg-muted"
            style={{ color: "var(--foreground-70)" }}
          >
            <ShoppingBag className="h-5 w-5" />
          </a>
        </nav>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -c "collapsed\|xl:flex w-16\|xl:hidden w-60" frontend/src/components/layout/Sidebar.tsx`
Expected: ненулевое (иконочная ветка на месте).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(layout): Sidebar collapsed icon-rail variant (xl+, opt-in via prop)"
```

---

### Task 5: `AppLayout` — проп `navCollapsed`

**Files:**
- Modify: `frontend/src/components/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: `Sidebar` c пропом `collapsed` (Task 4).
- Produces: `AppLayout` принимает `navCollapsed?: boolean`, прокидывает в `<Sidebar collapsed={navCollapsed} />`. Task 6 (ads.index) передаёт `navCollapsed`.

**Контекст:** `AppLayout` сейчас: `interface Props { children: ReactNode; rightColumn?: ReactNode | false; }` и рендерит `<Sidebar />`.

- [ ] **Step 1: Добавить проп в Props**

В `frontend/src/components/layout/AppLayout.tsx` заменить:
```tsx
interface Props {
  children: ReactNode;
  rightColumn?: ReactNode | false;
}

export function AppLayout({ children, rightColumn }: Props) {
```
на:
```tsx
interface Props {
  children: ReactNode;
  rightColumn?: ReactNode | false;
  navCollapsed?: boolean;
}

export function AppLayout({ children, rightColumn, navCollapsed }: Props) {
```

- [ ] **Step 2: Прокинуть в Sidebar**

Заменить `<Sidebar />` на `<Sidebar collapsed={navCollapsed} />`.

- [ ] **Step 3: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "navCollapsed\|Sidebar collapsed" frontend/src/components/layout/AppLayout.tsx`
Expected: три совпадения (Props, деструктуризация, использование).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/AppLayout.tsx
git commit -m "feat(layout): AppLayout navCollapsed prop wired to Sidebar"
```

---

### Task 6: `ads.index` сборка + `AdSortBar` кнопка xl:hidden

**Files:**
- Modify: `frontend/src/routes/ads.index.tsx`
- Modify: `frontend/src/components/ads/AdSortBar.tsx`

**Interfaces:**
- Consumes: `CatalogBreadcrumb` (Task 2), `AdFiltersPanel` (Task 3), `AppLayout` navCollapsed (Task 5).
- Produces: финальная сборка каталога.

**Контекст:** `ads.index.tsx` использует `<AppLayout rightColumn={false}>`, рендерит header (h1 «Объявления»), `CategoryChips`, затем `<div className="space-y-[12px]"><div className="min-w-0 space-y-[12px]">…AdSortBar/states…</div></div>` + `AdFiltersSheet`. `AdSortBar` кнопка «Фильтры» имеет класс `inline-flex items-center justify-center gap-[8px] px-[16px] text-[14px] font-medium`.

- [ ] **Step 1: Импорты ads.index**

В `frontend/src/routes/ads.index.tsx` добавить к импортам компонентов ads (рядом с `import { CatalogCard } …`):
```tsx
import { CatalogBreadcrumb } from "@/components/ads/CatalogBreadcrumb";
```
И в импорт из `@/components/ads/AdFilters` добавить `AdFiltersPanel`:
```tsx
import { type FiltersState, DEFAULT_FILTERS, AdFiltersSheet, AdFiltersPanel } from "@/components/ads/AdFilters";
```
(если текущая строка импорта из AdFilters не содержит `AdFiltersPanel` — добавить его.)

- [ ] **Step 2: navCollapsed на AppLayout**

Заменить `<AppLayout rightColumn={false}>` на `<AppLayout rightColumn={false} navCollapsed>`.

- [ ] **Step 3: Breadcrumb над заголовком**

Найти блок заголовка:
```tsx
        {/* Header */}
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <h1
              className="font-display text-[22px] font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              Объявления
            </h1>
```
заменить на (добавить breadcrumb перед `<h1>`):
```tsx
        {/* Header */}
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <CatalogBreadcrumb
              category={filters.category}
              subcategory={filters.subcategory}
              onResetToRoot={() => setFilters((p) => ({ ...p, category: "Все", subcategory: "Все" }))}
              onResetToCategory={() => setFilters((p) => ({ ...p, subcategory: "Все" }))}
            />
            <h1
              className="mt-[4px] font-display text-[22px] font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              Объявления
            </h1>
```
(добавлен `<CatalogBreadcrumb>` перед `<h1>` и `mt-[4px]` на `<h1>` для отступа.)

- [ ] **Step 4: Панель + grid во flex-row**

Заменить:
```tsx
        {/* Content — full width, filters live in the drawer */}
        <div className="space-y-[12px]">
          <div className="min-w-0 space-y-[12px]">
```
на:
```tsx
        {/* Content — persistent filter panel (xl+) + grid; drawer on <xl */}
        <div className="flex gap-[20px]">
          <AdFiltersPanel value={filters} onChange={setFilters} onReset={resetFilters} />
          <div className="min-w-0 flex-1 space-y-[12px]">
```
(внешний `space-y-[12px]` → `flex gap-[20px]`; добавлен `AdFiltersPanel`; внутренняя колонка получает `flex-1`. Закрывающие `</div></div>` остаются как есть — структура двухуровневая сохраняется.)

- [ ] **Step 5: AdSortBar — скрыть кнопку «Фильтры» на xl**

В `frontend/src/components/ads/AdSortBar.tsx` заменить класс кнопки:
```tsx
          className="inline-flex items-center justify-center gap-[8px] px-[16px] text-[14px] font-medium"
```
на:
```tsx
          className="inline-flex items-center justify-center gap-[8px] px-[16px] text-[14px] font-medium xl:hidden"
```

- [ ] **Step 6: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "CatalogBreadcrumb\|AdFiltersPanel\|navCollapsed" frontend/src/routes/ads.index.tsx`
Expected: импорты + использования.
Run: `grep -c "xl:hidden" frontend/src/components/ads/AdSortBar.tsx`
Expected: `1`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/routes/ads.index.tsx frontend/src/components/ads/AdSortBar.tsx
git commit -m "feat(catalog): wire persistent panel, breadcrumb, icon sidebar; hide filters button on xl"
```

---

## Notes для исполнителя

- Каждый таск заканчивается зелёным `npx tsc --noEmit` (из `frontend/`).
- Vitest/RTL не настроены — не писать/запускать unit-тесты; проверка = tsc + grep.
- Preview-QA (1280/1440/1600 + <1280 + mobile) и тонкая настройка — работа контроллера после тасков, НЕ в тасках.
- Порядок: T1–T5 независимы (T5 зависит от T4); T6 зависит от T2/T3/T5.
- Не коммитить мерж в master/neeklo без явного разрешения оператора.
