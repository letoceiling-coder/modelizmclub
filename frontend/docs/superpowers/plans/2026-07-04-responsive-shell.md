# Responsive Shell Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить фиксированный `max-w-7xl` (1280px) shell-контейнера на fluid clamp()-контейнер (cap 1560), выровнять DesktopTopBar по нему и дать каталогу 5-ю колонку на 2xl — чтобы ноутбучные экраны не выглядели узкой колонкой в пустоте.

**Architecture:** Один рычаг — shell-контейнер в `AppLayout`, подключённый к CSS-переменным `--container-max`/`--container-pad` (fluid). Плюс два точечных изменения: обёртка-контейнер в `DesktopTopBar` и `2xl:grid-cols-5` в каталоге.

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind v4 (CSS-конфиг), CSS custom properties + clamp().

## Global Constraints

- Работать строго внутри `frontend/`. Не трогать backend, routes, auth, состояния данных.
- Mobile-брейкпоинты (`px-3`, 360-430) и mobile-компоненты — НЕ трогать. Изменения только на `lg+`.
- Использовать существующие CSS-переменные `--container-max`/`--container-pad` (подключить, не плодить новые).
- `--container-max: 1560px`; `--container-pad: clamp(24px, 3vw, 56px)` (стартовые значения; тюнинг — в manual QA контроллера, не в тасках).
- Каталог: сетка `2→3→4→5` (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5`).
- Per-route inner max-width'ы (my-ads 960, notifications 640 и т.д.) — НЕ трогать.
- `messenger.tsx` высоту — не трогать (меняется только ширина shell).
- TypeScript strict, без `any`. После изменений `npx tsc --noEmit` (из `frontend/`) чистый.
- Нет unit-тест-раннера (Vitest/RTL не настроены). «Тест» задачи = `npx tsc --noEmit` + указанные grep-проверки. Визуальная проверка на 1280/1440/1600/1920 — manual QA контроллера после тасков, не в тасках.
- Не коммитить мерж без явного разрешения; коммиты по таскам разрешены.

---

### Task 1: Fluid shell-контейнер (styles.css переменные + AppLayout)

**Files:**
- Modify: `frontend/src/styles.css` (строки 68-69, блок `:root`)
- Modify: `frontend/src/components/layout/AppLayout.tsx` (строка ~32)

**Interfaces:**
- Produces: CSS-переменные `--container-max: 1560px`, `--container-pad: clamp(24px, 3vw, 56px)`; shell-контейнер `AppLayout`, использующий их на `lg+`. Task 2 (DesktopTopBar) переиспользует те же переменные.

**Контекст:** `styles.css:68-69` определяет `--container-max: 1280px` и `--container-pad: 32px`, но AppLayout их не использует (хардкодит `max-w-7xl`/`lg:px-6`). `--container-pad` также читается в `onboarding.tsx` (не AppLayout-страница) — смена на clamp даст ему responsive-паддинг, это приемлемо.

- [ ] **Step 1: Обновить переменные в styles.css**

В `frontend/src/styles.css`, в блоке `:root` заменить:
```css
  --container-max: 1280px;
  --container-pad: 32px;
```
на:
```css
  --container-max: 1560px;                    /* cap: контент не растягивается бесконечно на ultrawide */
  --container-pad: clamp(24px, 3vw, 56px);    /* fluid боковые поля, без прыжков на 1440/1600 */
```

- [ ] **Step 2: Подключить контейнер в AppLayout**

В `frontend/src/components/layout/AppLayout.tsx` заменить блок className (строки ~31-35):
```tsx
        className="
          mx-auto flex w-full max-w-7xl items-start gap-6 px-3 pt-4
          pb-[calc(var(--bottom-nav-space)+8px)]
          lg:flex-1 lg:items-stretch lg:overflow-hidden lg:px-6 lg:pb-0
        "
```
на:
```tsx
        className="
          mx-auto flex w-full max-w-[var(--container-max)] items-start gap-6 px-3 pt-4
          pb-[calc(var(--bottom-nav-space)+8px)]
          lg:flex-1 lg:items-stretch lg:overflow-hidden lg:px-[var(--container-pad)] lg:pb-0
        "
```
(Меняются только `max-w-7xl` → `max-w-[var(--container-max)]` и `lg:px-6` →
`lg:px-[var(--container-pad)]`. Mobile `px-3`, `gap-6`, `items-start`, `pt-4`,
flex/overflow/pb — без изменений.)

- [ ] **Step 3: Проверка tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: grep-проверки**

Run: `grep -n "container-max\|container-pad" frontend/src/components/layout/AppLayout.tsx`
Expected: две строки (max-w и lg:px используют переменные).
Run: `grep -n "max-w-7xl" frontend/src/components/layout/AppLayout.tsx`
Expected: пусто (хардкод убран).
Run: `grep -n "container-max: 1560px" frontend/src/styles.css`
Expected: одно совпадение.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles.css frontend/src/components/layout/AppLayout.tsx
git commit -m "feat(layout): fluid shell container via --container-max/--container-pad (clamp)"
```

---

### Task 2: Выровнять DesktopTopBar по shell-контейнеру

**Files:**
- Modify: `frontend/src/components/layout/DesktopTopBar.tsx`

**Interfaces:**
- Consumes: `--container-max`/`--container-pad` (Task 1).
- Produces: header full-width (фон/border на всю ширину) с внутренней обёрткой, выровненной по shell.

**Контекст:** Сейчас `<header className="hidden lg:flex shrink-0 items-center gap-4 px-6" style={{height, background, borderBottom}}>` — сам header является flex-контейнером с прямыми детьми (логотип, поиск, правые контролы). Нужно: header остаётся full-width полосой (фон + border-bottom на всю ширину), а его содержимое переносится в inner-div с тем же max-width/padding, что у shell.

- [ ] **Step 1: Реструктурировать header**

В `frontend/src/components/layout/DesktopTopBar.tsx` заменить открывающий тег header и добавить обёртку. Из:
```tsx
    <header
      className="hidden lg:flex shrink-0 items-center gap-4 px-6"
      style={{
        height: "var(--desktop-topbar-h)",
        background: "var(--background)",
        borderBottom: "1px solid var(--border)",
      }}
    >
```
на:
```tsx
    <header
      className="hidden shrink-0 lg:block"
      style={{
        height: "var(--desktop-topbar-h)",
        background: "var(--background)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[var(--container-max)] items-center gap-4 px-[var(--container-pad)]">
```
(header: `lg:flex items-center gap-4 px-6` → `lg:block` + inner-div несёт flex/gap/max-width/padding. `hidden`/`shrink-0`/height/bg/border сохранены на header.)

- [ ] **Step 2: Закрыть обёртку перед `</header>`**

Найти закрывающий `</header>` компонента и добавить перед ним закрытие нового `<div>`. Из:
```tsx
        <UserMenu />
      </div>
    </header>
```
(где `<div>` — это существующий контейнер правых контролов `ml-auto flex …`)
на:
```tsx
        <UserMenu />
      </div>
      </div>
    </header>
```
(Добавлен один `</div>` — закрытие новой обёртки, обнимающей весь контент header. Проверить парность: новый inner-div из Step 1 открывается сразу после `<header>`, закрывается перед `</header>`.)

- [ ] **Step 3: Проверка tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок. Если JSX-структура разъехалась (лишний/недостающий `</div>`) — tsc/сборка покажет; выровнять парность тегов.

- [ ] **Step 4: grep-проверка**

Run: `grep -n "container-max\|container-pad" frontend/src/components/layout/DesktopTopBar.tsx`
Expected: одна строка (inner-обёртка использует обе переменные).
Run: `grep -n "lg:flex shrink-0 items-center gap-4 px-6" frontend/src/components/layout/DesktopTopBar.tsx`
Expected: пусто (старый header-класс заменён).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/DesktopTopBar.tsx
git commit -m "feat(layout): align DesktopTopBar content with shell container"
```

---

### Task 3: Каталог — 5-я колонка на 2xl

**Files:**
- Modify: `frontend/src/routes/ads.index.tsx` (два грид-блока)

**Interfaces:**
- Consumes: широкий main из Task 1.
- Produces: сетка каталога `2→3→4→5`.

**Контекст:** В `ads.index.tsx` два грид-контейнера (loading-скелетоны и data) используют класс `grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4`. Добавить `2xl:grid-cols-5` (стандартный Tailwind брейкпоинт 1536px).

- [ ] **Step 1: Loading-грид**

В `frontend/src/routes/ads.index.tsx` заменить:
```tsx
            {loadState === "loading" && (
              <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4">
```
на:
```tsx
            {loadState === "loading" && (
              <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
```

- [ ] **Step 2: Data-грид**

Заменить:
```tsx
            {loadState === "ok" && ads.length > 0 && (
              <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4">
```
на:
```tsx
            {loadState === "ok" && ads.length > 0 && (
              <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
```

- [ ] **Step 3: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -c "2xl:grid-cols-5" frontend/src/routes/ads.index.tsx`
Expected: `2` (оба грид-блока).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/ads.index.tsx
git commit -m "feat(catalog): add 5th column at 2xl (grid 2/3/4/5)"
```

---

## Notes для исполнителя

- Каждый таск заканчивается зелёным `npx tsc --noEmit` (из `frontend/`).
- Vitest/RTL не настроены — не писать/запускать unit-тесты; проверка = tsc + grep.
- Визуальная проверка на 1280/1440/1600/1920 (preview) и тюнинг clamp-коэффициентов — работа контроллера после всех тасков, НЕ в тасках.
- Не коммитить мерж в master/neeklo без явного разрешения оператора.
