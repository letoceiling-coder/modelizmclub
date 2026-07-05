# Body Scroll Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На страницах без правого rail (`rightColumn === false`) сдвинуть скроллбар `<main>` к краю контентного контейнера, устранив видимый зазор `--container-pad`.

**Architecture:** Один условный Tailwind-класс на `<main>` в `AppLayout.tsx`: отрицательный правый margin, равный `--container-pad`, компенсированный таким же `padding-right`, чтобы визуальный отступ контента не изменился, а скроллбар оказался у внешней границы родительской flex-строки.

**Tech Stack:** React 18, TypeScript strict, Tailwind v4, существующий `cn()` helper.

## Global Constraints

- Работать строго внутри `frontend/`. Не трогать backend, routes, auth.
- Не трогать App Shell модель (`100dvh`, `overflow-hidden`, fixed topbar/sidebar), `DesktopTopBar.tsx`, `Sidebar.tsx`, `RightCategories.tsx`, `messenger.tsx`.
- Фикс применяется **только** когда `rightColumn === false` (страницы без rail: `/ads`, `/my-ads`, `/messenger`, `/channels`, `/communities` index). Страницы с rail (`/feed`, `/profile`) — без изменений.
- На ultrawide (≥1920) скроллбар должен сесть на границу `--container-max`-контейнера, НЕ на физический край окна — это должно получиться автоматически из механики (не требует отдельного кода).
- Только `lg:`-варианты классов — mobile не затрагивается.
- TypeScript strict, без `any`. После изменений `npx tsc --noEmit` (из `frontend/`) чистый.
- Нет unit-тест-раннера — «тест» = `npx tsc --noEmit` + grep + preview-QA (на 1280/1440/1600/1920, `/ads` и `/feed`) контроллером после таска.
- Не коммитить мерж без явного разрешения; коммит по таску разрешён.

---

### Task 1: Сдвинуть скроллбар `<main>` к краю контейнера на страницах без rail

**Files:**
- Modify: `frontend/src/components/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: `cn` из `@/lib/utils` (уже используется в проекте, напр. `CatalogCard.tsx`); существующий проп `rightColumn` (не меняется, только читается).
- Produces: нет новых экспортов.

**Контекст:** Текущий файл (полностью):
```tsx
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { RightCategories } from "./RightCategories";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { DesktopTopBar } from "./DesktopTopBar";

interface Props {
  children: ReactNode;
  rightColumn?: ReactNode | false;
  navCollapsed?: boolean;
}

export function AppLayout({ children, rightColumn, navCollapsed }: Props) {
  return (
    // 100dvh keeps the shell stable on mobile Safari/Chrome (no 100vh jump).
    // overflow-x-clip is a belt-and-braces guard against horizontal scroll.
    // Desktop: shell is a flex column clamped to 100dvh with overflow hidden.
    // Only <main> scrolls — sidebar and right rail are fixed-height columns.
    // Mobile: normal document scroll (min-h, no overflow-hidden, no flex-col).
    <div className="min-h-[100dvh] overflow-x-clip bg-background lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-hidden">
      <MobileHeader />
      <DesktopTopBar />
      {/*
        Mobile: pt-4/pb/px-3 — normal flow with BottomNav clearance.
        Desktop: flex-1 fills remaining shell height; items-stretch makes all
        three columns (sidebar, main, right rail) full-height so each can
        manage its own overflow independently. pt-4 is kept on both breakpoints
        so the top spacing is unchanged from the previous design.
      */}
      <div
        className="
          mx-auto flex w-full max-w-[var(--container-max)] items-start gap-6 px-3 pt-4
          pb-[calc(var(--bottom-nav-space)+8px)]
          lg:flex-1 lg:items-stretch lg:overflow-hidden lg:px-[var(--container-pad)] lg:pb-0
        "
      >
        <Sidebar collapsed={navCollapsed} />
        {/* Center column: the only scroll zone on desktop. */}
        <main className="min-w-0 flex-1 lg:overflow-y-auto">{children}</main>
        {rightColumn === false ? null : rightColumn ?? <RightCategories />}
      </div>
      <BottomNav />
    </div>
  );
}
```

`<main>`'s scrollbar sits `--container-pad` away from the flex row's own right
edge because the row has `lg:px-[var(--container-pad)]`. Pushing `<main>` right
by exactly `--container-pad` (negative margin) lands its border-box edge on the
row's own edge — inside the row's padding area, so the row's `lg:overflow-hidden`
does not clip it. Restoring the same amount as `padding-right` on `<main>` keeps
its inner content visually inset by the same distance as before.

- [ ] **Step 1: Добавить импорт `cn`**

В `frontend/src/components/layout/AppLayout.tsx` добавить после первой строки импорта:
```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
```

- [ ] **Step 2: Заменить `<main>` на условный класс**

Заменить:
```tsx
        <main className="min-w-0 flex-1 lg:overflow-y-auto">{children}</main>
```
на:
```tsx
        <main
          className={cn(
            "min-w-0 flex-1 lg:overflow-y-auto",
            rightColumn === false && "lg:mr-[calc(-1*var(--container-pad))] lg:pr-[var(--container-pad)]",
          )}
        >
          {children}
        </main>
```

- [ ] **Step 3: Проверка tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: grep-проверки**

Run: `grep -n "cn(" frontend/src/components/layout/AppLayout.tsx`
Expected: одно совпадение (использование в `<main>`).
Run: `grep -c "lg:mr-\[calc(-1\*var(--container-pad))\]" frontend/src/components/layout/AppLayout.tsx`
Expected: `1`.
Run: `grep -n "DesktopTopBar\|Sidebar\|RightCategories\|BottomNav\|MobileHeader" frontend/src/components/layout/AppLayout.tsx`
Expected: те же импорты/использования, что и до изменения (файл больше нигде не менялся).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/AppLayout.tsx
git commit -m "feat(layout): pull <main> scrollbar to container edge on no-rail pages"
```

---

## Notes для исполнителя

- Единственный файл. `tsc` — единственная автоматическая проверка; визуальное
  подтверждение (скроллбар у края на 1280/1440/1600/1920, `/ads` меняется,
  `/feed` не меняется, mobile не меняется) — работа контроллера через preview
  после таска, не часть самого таска.
- Не коммитить мерж в master/neeklo без явного разрешения оператора.
