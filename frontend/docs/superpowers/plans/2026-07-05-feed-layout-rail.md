# Feed Layout — Compact Right Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить на `/feed` доминирующий rail-список всех категорий на
компактный feed-специфичный виджет-стек (топ-категории + рекомендованные
сообщества + возможные друзья), не трогая ширину центра ленты.

**Architecture:** Новый компонент `FeedRightRail` (три компактные карточки +
collapse) передаётся во `feed.tsx` через `AppLayout rightColumn={...}`, что
ограничивает изменение строго `/feed`. Общий хелпер `onlineFor` выносится в
`lib/category-online.ts` и переиспользуется существующими `RightCategories`
и `FindYourPeopleSheet` (без изменения их поведения). Данные — существующие
demo-safe функции `usePostCategories`/`fetchCommunities`/`searchUsers`.

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind v4
(CSS-переменные), lucide-react.

## Global Constraints

- Работать строго внутри `frontend/`.
- Не трогать: ширину центра ленты (уже корректна — 677/814/896px на
  1280/1440/1920), `RightCategories`-поведение, страницы
  `/notifications`/`/friends`/`/profile`, feed API, логику публикации,
  `PostCard`, композер, mobile (`FindYourPeopleSheet` — остаётся).
- Rail — только `xl+` (`hidden xl:block`), ширина `w-64` (256px), стиль
  карточек: `background: var(--background-elevated)`,
  `border: 1px solid var(--border)`, `border-radius: 14px`.
- Rail-строки навигационные (Link), без кнопок Вступить/Добавить.
- Пустые секции карточек скрываются целиком; loading — skeleton-строки.
- backend не трогается, новых endpoint'ов нет — `backend-endpoints-needed.md`
  НЕ обновляется.
- После каждой задачи `npx tsc --noEmit` чист.
- Юнит-тестов в проекте нет — верификация через `tsc --noEmit`, `grep`,
  ручной QA через `preview_*` MCP.

---

### Task 1: Вынести общий хелпер `onlineFor` в `lib/category-online.ts`

**Files:**
- Create: `src/lib/category-online.ts`
- Modify: `src/components/layout/RightCategories.tsx` (удалить локальную
  `onlineFor`, импортировать общую)
- Modify: `src/components/feed/FindYourPeopleSheet.tsx` (то же)

**Interfaces:**
- Produces: `export function onlineFor(c: Category): number` — детерминированный
  «онлайн» по id категории. Используется Task 2.

- [ ] **Step 1: Создать `src/lib/category-online.ts`**

```ts
import type { Category } from "@/lib/mock";

// Детерминированный «онлайн» по id категории — без бэка, но стабильно
// от рендера к рендеру. Общий источник для правых панелей и мобильного шита.
export function onlineFor(c: Category): number {
  const seed = c.id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const base = Math.max(3, Math.round(c.members * 0.012));
  return base + (seed % 17);
}
```

- [ ] **Step 2: Мигрировать `RightCategories.tsx`**

Найти (строки ~10-15):

```ts
// Детерминированный «онлайн» по id категории — без бэка, но стабильно от рендера к рендеру.
function onlineFor(c: Category): number {
  const seed = c.id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const base = Math.max(3, Math.round(c.members * 0.012));
  return base + (seed % 17);
}
```

Удалить этот блок. Затем найти строку импорта типа `Category`:

```ts
import type { Category } from "@/lib/mock";
```

Добавить сразу после неё:

```ts
import { onlineFor } from "@/lib/category-online";
```

(`Category` всё ещё используется в `CategoryIcon`/`onlineFor`-параметре? После
удаления `onlineFor` тип `Category` в `RightCategories` больше не используется
напрямую — проверить: если `npx tsc --noEmit` пожалуется на неиспользуемый
импорт, `noUnusedLocals` в проекте = `false` (проверено в tsconfig), так что
ошибки не будет. Импорт `Category` можно оставить.)

- [ ] **Step 3: Мигрировать `FindYourPeopleSheet.tsx`**

Найти (строки ~16-20):

```ts
function onlineFor(c: Category): number {
  const seed = c.id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const base = Math.max(3, Math.round(c.members * 0.012));
  return base + (seed % 17);
}
```

Удалить. Найти:

```ts
import type { Category } from "@/lib/mock";
```

Добавить сразу после:

```ts
import { onlineFor } from "@/lib/category-online";
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Grep-проверка отсутствия дублей**

Run: `grep -rn "function onlineFor" src/components src/routes`
Expected: пусто (единственное определение теперь в `src/lib/category-online.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/category-online.ts src/components/layout/RightCategories.tsx src/components/feed/FindYourPeopleSheet.tsx
git commit -m "refactor(rail): extract shared onlineFor helper to lib/category-online"
```

---

### Task 2: Компонент `FeedRightRail`

**Files:**
- Create: `src/components/feed/FeedRightRail.tsx`

**Interfaces:**
- Consumes: `onlineFor` (Task 1), `usePostCategories`
  (`src/lib/hooks/useCategories.ts`), `fetchCommunities`
  (`src/lib/api/communities.ts`), `searchUsers` (`src/lib/api/social.ts`),
  `useStore` + `s.blockedUserIds` (`src/lib/store.ts`), `Skeleton`
  (`src/components/ui/skeleton.tsx`).
- Produces: `export function FeedRightRail()` — колонка правого rail для
  `/feed`. Используется Task 3.

- [ ] **Step 1: Создать `src/components/feed/FeedRightRail.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  PanelRightClose, PanelRightOpen, ChevronRight,
  Car, Plane, Ship, Send, Code2, Wrench, Cpu, BatteryCharging, Users, Hash,
} from "lucide-react";
import * as Icons from "lucide-react";
import type { Community, User } from "@/lib/mock";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { onlineFor } from "@/lib/category-online";
import { fetchCommunities } from "@/lib/api/communities";
import { searchUsers } from "@/lib/api/social";
import { useStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";

const COLLAPSE_KEY = "modelizm:feedrail:collapsed";

const COMMUNITY_ICON_MAP: Record<string, typeof Car> = {
  Car, Plane, Ship, Send, Code2, Wrench, Cpu, BatteryCharging,
};

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ??
    Hash;
  return <Icon className={className} />;
}

function RailCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, to, onCollapse }: { title: string; to: string; onCollapse?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-[14px] py-[11px]" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-[13.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
        {title}
      </h3>
      <div className="flex items-center gap-[2px]">
        <Link
          to={to}
          className="flex items-center gap-[2px] text-[12px] transition-colors hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          Все <ChevronRight className="h-[13px] w-[13px]" />
        </Link>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Свернуть панель"
            className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-50)" }}
          >
            <PanelRightClose className="h-[15px] w-[15px]" />
          </button>
        )}
      </div>
    </div>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-[10px] p-[10px]">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-[10px]">
          <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-[8px]" />
          <div className="flex-1 space-y-[6px]">
            <Skeleton className="h-[10px] rounded-[6px]" style={{ width: `${55 + (i * 13) % 30}%` }} />
            <Skeleton className="h-[9px] rounded-[6px]" style={{ width: `${35 + (i * 11) % 25}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedRightRail() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const categories = usePostCategories();
  const blockedUserIds = useStore((s) => s.blockedUserIds);

  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [people, setPeople] = useState<User[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCommunities()
      .then((cs) => { if (alive) setCommunities(cs.filter((c) => !c.joined).slice(0, 3)); })
      .catch(() => { if (alive) setCommunities([]); });
    searchUsers("")
      .then((us) => { if (alive) setPeople(us.slice(0, 6)); })
      .catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, []);

  if (collapsed) {
    return (
      <aside className="hidden xl:flex w-11 shrink-0 justify-center pt-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Развернуть панель"
          className="grid h-9 w-9 place-items-center rounded-[10px] border transition-colors hover:bg-[var(--background-surface)]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)", color: "var(--foreground-70)" }}
        >
          <PanelRightOpen className="h-[18px] w-[18px]" />
        </button>
      </aside>
    );
  }

  const topCategories = categories.slice(0, 5);
  const suggestedPeople = (people ?? []).filter((u) => !blockedUserIds.includes(u.id)).slice(0, 3);

  return (
    <aside className="hidden xl:block w-64 shrink-0">
      <div className="flex h-full flex-col gap-[12px] overflow-y-auto pb-4" style={{ scrollbarWidth: "thin" }}>

        {/* Card 1 — Категории */}
        <RailCard>
          <CardHeader title="Категории" to="/categories" onCollapse={() => setCollapsed(true)} />
          <ul className="p-[6px]">
            {topCategories.map((c) => {
              const online = onlineFor(c);
              return (
                <li key={c.id}>
                  <Link
                    to="/categories/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-[10px] rounded-[10px] px-[10px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
                  >
                    <span
                      className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[8px]"
                      style={{ background: "var(--background-surface)", color: "var(--accent)" }}
                    >
                      <CategoryIcon name={c.icon} className="h-[14px] w-[14px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--foreground)" }}>
                        {c.name}
                      </span>
                      <span className="mt-[1px] flex items-center gap-[5px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
                        <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#22c55e" }} />
                        {online} онлайн
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </RailCard>

        {/* Card 2 — Сообщества для вас */}
        {communities === null ? (
          <RailCard>
            <CardHeader title="Сообщества" to="/communities" />
            <SkeletonRows n={3} />
          </RailCard>
        ) : communities.length > 0 ? (
          <RailCard>
            <CardHeader title="Сообщества" to="/communities" />
            <ul className="p-[6px]">
              {communities.map((c) => {
                const Icon = COMMUNITY_ICON_MAP[c.avatarIcon ?? "Users"] ?? Users;
                return (
                  <li key={c.id}>
                    <Link
                      to="/communities/$id"
                      params={{ id: c.id }}
                      className="flex items-center gap-[10px] rounded-[10px] px-[10px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
                    >
                      <span
                        className="grid h-[30px] w-[30px] shrink-0 place-items-center overflow-hidden rounded-[8px]"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        {c.avatarImage ? (
                          <img src={c.avatarImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Icon className="h-[15px] w-[15px]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--foreground)" }}>
                          {c.name}
                        </span>
                        <span className="mt-[1px] block text-[11px]" style={{ color: "var(--foreground-50)" }}>
                          {c.members.toLocaleString("ru")} участников
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </RailCard>
        ) : null}

        {/* Card 3 — Возможные друзья */}
        {people === null ? (
          <RailCard>
            <CardHeader title="Возможные друзья" to="/friends" />
            <SkeletonRows n={3} />
          </RailCard>
        ) : suggestedPeople.length > 0 ? (
          <RailCard>
            <CardHeader title="Возможные друзья" to="/friends" />
            <ul className="p-[6px]">
              {suggestedPeople.map((u) => (
                <li key={u.id}>
                  <Link
                    to="/user/$id"
                    params={{ id: u.slug ?? u.id }}
                    className="flex items-center gap-[10px] rounded-[10px] px-[10px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
                  >
                    <img src={u.avatar} alt="" className="h-[30px] w-[30px] shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--foreground)" }}>
                        {u.name}
                      </span>
                      <span className="mt-[1px] block truncate text-[11px]" style={{ color: "var(--foreground-50)" }}>
                        {u.city}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </RailCard>
        ) : null}

      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/FeedRightRail.tsx
git commit -m "feat(feed): FeedRightRail — compact categories/communities/people widget stack"
```

---

### Task 3: Подключить `FeedRightRail` во `feed.tsx` + QA

**Files:**
- Modify: `src/routes/feed.tsx` (импорт + строка `<AppLayout footer>`)

**Interfaces:**
- Consumes: `FeedRightRail` (Task 2).

- [ ] **Step 1: Импортировать `FeedRightRail`**

Найти в `src/routes/feed.tsx`:

```ts
import { SponsoredPostCard } from "@/components/feed/SponsoredPostCard";
```

Добавить сразу после неё:

```ts
import { FeedRightRail } from "@/components/feed/FeedRightRail";
```

- [ ] **Step 2: Передать rail в AppLayout**

Найти (строка 169):

```tsx
    <AppLayout footer>
```

Заменить на:

```tsx
    <AppLayout footer rightColumn={<FeedRightRail />}>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Manual QA (preview_* MCP, breakpoints из тикета)**

Запустить dev-сервер, открыть `/feed`. Проверить на 1280 / 1440 / 1920
(`preview_resize`):
- Rail — компактный стек из 3 карточек (Категории топ-5 / Сообщества /
  Возможные друзья), НЕ длинный список всех категорий.
- Центр ленты не изменился (замеры должны совпасть с before: 677/814/896px).
- Каждая карточка при первом заходе может мигнуть skeleton-строками, затем
  данными.
- Collapse: клик по кнопке в шапке карточки «Категории» сворачивает rail в
  узкую полосу с кнопкой развернуть; клик разворачивает; состояние
  переживает reload (localStorage).
- Ссылки «Все →» ведут на `/categories`, `/communities`, `/friends`; строки
  ведут на соответствующие сущности.
- Пустые секции: если demo-данных для сообществ/друзей нет — карточка
  скрыта (не показывается пустая заглушка). Категории всегда есть.

- [ ] **Step 5: Скриншот-подтверждение**

Сделать `preview_screenshot` на 1440px как визуальное подтверждение нового
rail.

- [ ] **Step 6: Commit**

```bash
git add src/routes/feed.tsx
git commit -m "feat(feed): use compact FeedRightRail as feed right column"
```

---

## После завершения плана

Использовать `superpowers:finishing-a-development-branch` — merge в `master`,
затем в `neeklo` (fetch первым, merge не rebase), деплой на VPS через
`deploy/scripts/deploy-neeklo-frontend.sh`, обновить
`memory/project_neeklo_stand.md` новым HEAD.
