# AppFooter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать 8 внутренним страницам единый скроллящийся `AppFooter` (Поддержка/Компания/Документы/Соцсети), убрать Telegram-упоминание отовсюду, добавить честные placeholder-страницы «Контакты»/«Безопасность».

**Architecture:** Общий модуль данных `lib/footer-links.ts` → новый `AppFooter.tsx` (узкий layout) → опциональный проп `footer` на `AppLayout` (рендерится внутри скроллящегося `<main>`) → 8 страниц подключают проп → 2 новые записи в `/info/$slug` → правка лендинг-Footer (убрать Telegram, добавить соцсети из общего модуля).

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind, существующий `cn()` helper.

## Global Constraints

- Работать строго внутри `frontend/`. Не трогать backend, auth.
- Ни одного упоминания Telegram нигде в проекте — не TODO, полное отсутствие.
- MAX и VK — честные неактивные TODO-чипы (`<span>`, не `<a href>`), без реального URL.
- `/messenger` — не подключает футер (фиксированная grid-высота чата, разрешённый тикетом escape hatch).
- Существующие 4 колонки лендинг-футера (бренд/МоДелизМ/Документы/Поддержка со своими текущими ссылками) — не трогать, кроме удаления Telegram-строки и добавления соцсетей в блок «Контакты».
- Футер рендерится внутри `<main>` (скроллящийся контейнер), никогда не `fixed`, не может перекрыть `Sidebar`/`RightCategories`.
- TypeScript strict, без `any`. После изменений `npx tsc --noEmit` (из `frontend/`) чистый.
- Нет unit-тест-раннера — «тест» = `npx tsc --noEmit` + grep. Preview-QA (8 страниц, короткий/длинный контент, лендинг, `/messenger` не задет) — работа контроллера после тасков.
- Не коммитить мерж без явного разрешения; коммиты по таскам разрешены.

---

### Task 1: `footer-links.ts` — общий источник данных

**Files:**
- Create: `frontend/src/lib/footer-links.ts`

**Interfaces:**
- Produces: `FooterLink { label: string; to: string }`, `FooterSocial { label: string; href: string | null }`, `SUPPORT_LINKS`, `COMPANY_LINKS`, `DOCS_LINKS`, `SOCIAL_LINKS` (все `FooterLink[]`/`FooterSocial[]`). Используется в Task 3 (`AppFooter`) и Task 7 (лендинг).

- [ ] **Step 1: Проверить, что файла нет**

Run: `ls frontend/src/lib/footer-links.ts 2>&1`
Expected: `No such file or directory`.

- [ ] **Step 2: Создать модуль**

Создать `frontend/src/lib/footer-links.ts`:

```ts
export interface FooterLink {
  label: string;
  to: string;
}

export interface FooterSocial {
  label: string;
  href: string | null;
}

export const SUPPORT_LINKS: FooterLink[] = [
  { label: "Помощь и FAQ", to: "/help" },
  { label: "Написать в поддержку", to: "/info/support" },
  { label: "Оставить отзыв", to: "/info/feedback" },
];

export const COMPANY_LINKS: FooterLink[] = [
  { label: "О компании", to: "/info/company" },
  { label: "Реклама", to: "/info/advertising" },
  { label: "Контакты", to: "/info/contacts" },
];

export const DOCS_LINKS: FooterLink[] = [
  { label: "Правила", to: "/legal/rules" },
  { label: "Безопасность", to: "/info/security" },
];

// href: null — no confirmed real account. Rendered as a disabled/TODO chip,
// never a live link (no Telegram anywhere; MAX/VK unconfirmed).
export const SOCIAL_LINKS: FooterSocial[] = [
  { label: "MAX", href: null },
  { label: "VK", href: null },
];
```

- [ ] **Step 3: Проверка tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/footer-links.ts
git commit -m "feat(footer): shared footer link/social data module"
```

---

### Task 2: `/info/$slug` — записи contacts/security

**Files:**
- Modify: `frontend/src/routes/info.$slug.tsx` (строка ~15, `PAGES`-словарь)

**Interfaces:**
- Consumes: существующий `PAGES: Record<string, { title: string; desc: string }>`.
- Produces: `/info/contacts` и `/info/security` резолвятся с честным контентом вместо fallback «Страница в подготовке».

**Контекст:** `PAGES`-словарь заканчивается записью `feedback` (строка 15) перед закрывающей `};`.

- [ ] **Step 1: Добавить записи**

В `frontend/src/routes/info.$slug.tsx` найти строку:
```ts
  feedback: { title: "Обратная связь", desc: "Ваши идеи и замечания делают платформу лучше. Оставьте отзыв или сообщите о проблеме." },
```
добавить сразу после неё:
```ts
  contacts: { title: "Контакты", desc: "Свяжитесь с нами: support@modelizmclub.ru, 8 800 000-00-00, Пн–Вс 10:00–20:00 МСК. Ссылки на соцсети появятся, когда официальные каналы будут запущены." },
  security: { title: "Безопасность", desc: "Принципы безопасной сделки, модерация объявлений и защита персональных данных на платформе МоДелизМ. Полная редакция публикуется при запуске продакшен-версии." },
```

- [ ] **Step 2: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -c "contacts:\|security:" frontend/src/routes/info.\$slug.tsx`
Expected: `2`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/info.\$slug.tsx
git commit -m "feat(info): add contacts and security placeholder pages"
```

---

### Task 3: `AppFooter.tsx` — компонент (new)

**Files:**
- Create: `frontend/src/components/layout/AppFooter.tsx`

**Interfaces:**
- Consumes: `SUPPORT_LINKS`, `COMPANY_LINKS`, `DOCS_LINKS`, `SOCIAL_LINKS` из `@/lib/footer-links` (Task 1).
- Produces: `export function AppFooter(): JSX.Element` — без пропсов. Используется в Task 4 (`AppLayout`).

- [ ] **Step 1: Проверить, что файла нет**

Run: `ls frontend/src/components/layout/AppFooter.tsx 2>&1`
Expected: `No such file or directory`.

- [ ] **Step 2: Создать компонент**

Создать `frontend/src/components/layout/AppFooter.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { SUPPORT_LINKS, COMPANY_LINKS, DOCS_LINKS, SOCIAL_LINKS } from "@/lib/footer-links";

const COLUMNS: { title: string; links: typeof SUPPORT_LINKS }[] = [
  { title: "Поддержка", links: SUPPORT_LINKS },
  { title: "Компания", links: COMPANY_LINKS },
  { title: "Документы", links: DOCS_LINKS },
];

export function AppFooter() {
  return (
    <footer
      className="mt-[32px] w-full"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="grid gap-[24px] py-[24px] sm:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              {col.title}
            </div>
            <ul className="mt-[10px] flex flex-col gap-[8px]">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-[13px] transition-colors"
                    style={{ color: "var(--foreground-50)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-50)")}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-[10px] pb-[16px]">
        {SOCIAL_LINKS.map((s) => (
          <span
            key={s.label}
            title="Скоро"
            className="inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[11px] font-semibold"
            style={{
              background: "var(--background-surface)",
              color: "var(--foreground-50)",
              border: "1px solid var(--border)",
            }}
          >
            {s.label}
          </span>
        ))}
      </div>

      <div className="pb-[24px] text-[11px]" style={{ color: "var(--foreground-30)" }}>
        © {new Date().getFullYear()} МоДелизМ
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "export function AppFooter" frontend/src/components/layout/AppFooter.tsx`
Expected: одно совпадение.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/AppFooter.tsx
git commit -m "feat(layout): AppFooter component (support/company/docs columns + social TODO chips)"
```

---

### Task 4: `AppLayout.tsx` — проп `footer`

**Files:**
- Modify: `frontend/src/components/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: `AppFooter` из `./AppFooter` (Task 3).
- Produces: `AppLayout` принимает `footer?: boolean`. 8 страниц (Task 5) передают его.

**Контекст:** Текущий файл (полностью, для точных before/after):
```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
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
        <main
          className={cn(
            "min-w-0 flex-1 lg:overflow-y-auto",
            rightColumn === false && "lg:mr-[calc(-1*var(--container-pad))] lg:pr-[var(--container-pad)]",
          )}
        >
          {children}
        </main>
        {rightColumn === false ? null : rightColumn ?? <RightCategories />}
      </div>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 1: Импорт AppFooter**

Заменить:
```tsx
import { DesktopTopBar } from "./DesktopTopBar";
```
на:
```tsx
import { DesktopTopBar } from "./DesktopTopBar";
import { AppFooter } from "./AppFooter";
```

- [ ] **Step 2: Добавить проп в Props и сигнатуру**

Заменить:
```tsx
interface Props {
  children: ReactNode;
  rightColumn?: ReactNode | false;
  navCollapsed?: boolean;
}

export function AppLayout({ children, rightColumn, navCollapsed }: Props) {
```
на:
```tsx
interface Props {
  children: ReactNode;
  rightColumn?: ReactNode | false;
  navCollapsed?: boolean;
  footer?: boolean;
}

export function AppLayout({ children, rightColumn, navCollapsed, footer }: Props) {
```

- [ ] **Step 3: Рендерить AppFooter внутри main**

Заменить:
```tsx
        >
          {children}
        </main>
```
на:
```tsx
        >
          {children}
          {footer && <AppFooter />}
        </main>
```

- [ ] **Step 4: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "AppFooter\|footer?:" frontend/src/components/layout/AppLayout.tsx`
Expected: минимум 3 совпадения (импорт, Props, использование в JSX).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/AppLayout.tsx
git commit -m "feat(layout): AppLayout optional footer prop, renders inside scrollable main"
```

---

### Task 5: Подключить `footer` на 8 страницах

**Files:**
- Modify: `frontend/src/routes/feed.tsx` (строка ~169)
- Modify: `frontend/src/routes/ads.index.tsx` (строка ~105)
- Modify: `frontend/src/routes/my-ads.tsx` (строка ~159)
- Modify: `frontend/src/routes/profile.tsx` (строка ~176)
- Modify: `frontend/src/routes/friends.tsx` (строка ~155)
- Modify: `frontend/src/routes/communities.index.tsx` (строка ~178)
- Modify: `frontend/src/routes/channels.index.tsx` (строка ~54)
- Modify: `frontend/src/routes/notifications.tsx` (строка ~79)

**Interfaces:**
- Consumes: `AppLayout` проп `footer` (Task 4).
- Produces: нет новых экспортов.

**Контекст:** Текущие вызовы `<AppLayout>` на каждой странице (точные строки,
проверено grep перед написанием плана):
- `feed.tsx:169`: `<AppLayout>`
- `ads.index.tsx:105`: `<AppLayout rightColumn={false} navCollapsed>`
- `my-ads.tsx:159`: `<AppLayout rightColumn={false}>`
- `profile.tsx:176`: `<AppLayout>`
- `friends.tsx:155`: `<AppLayout>`
- `communities.index.tsx:178`: `<AppLayout rightColumn={false}>`
- `channels.index.tsx:54`: `<AppLayout rightColumn={false}>`
- `notifications.tsx:79`: `<AppLayout>`

- [ ] **Step 1: feed.tsx**

Заменить:
```tsx
    <AppLayout>
```
на:
```tsx
    <AppLayout footer>
```

- [ ] **Step 2: ads.index.tsx**

Заменить:
```tsx
    <AppLayout rightColumn={false} navCollapsed>
```
на:
```tsx
    <AppLayout rightColumn={false} navCollapsed footer>
```

- [ ] **Step 3: my-ads.tsx**

Заменить:
```tsx
    <AppLayout rightColumn={false}>
```
на:
```tsx
    <AppLayout rightColumn={false} footer>
```

- [ ] **Step 4: profile.tsx**

Заменить:
```tsx
    <AppLayout>
```
на:
```tsx
    <AppLayout footer>
```

- [ ] **Step 5: friends.tsx**

Заменить:
```tsx
    <AppLayout>
```
на:
```tsx
    <AppLayout footer>
```

- [ ] **Step 6: communities.index.tsx**

Заменить:
```tsx
    <AppLayout rightColumn={false}>
```
на:
```tsx
    <AppLayout rightColumn={false} footer>
```

- [ ] **Step 7: channels.index.tsx**

Заменить:
```tsx
    <AppLayout rightColumn={false}>
```
на:
```tsx
    <AppLayout rightColumn={false} footer>
```

- [ ] **Step 8: notifications.tsx**

Заменить:
```tsx
    <AppLayout>
```
на:
```tsx
    <AppLayout footer>
```

- [ ] **Step 9: Проверка tsc + grep**

Каждый из 8 файлов содержит ровно одно вхождение `<AppLayout>` (проверено
заранее — `grep -c "<AppLayout" <файл>` даёт `1` для каждого), поэтому замены
в Steps 1-8 однозначны, без веток loading/error с отдельным `<AppLayout>`.

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -c "footer" frontend/src/routes/feed.tsx frontend/src/routes/ads.index.tsx frontend/src/routes/my-ads.tsx frontend/src/routes/profile.tsx frontend/src/routes/friends.tsx frontend/src/routes/communities.index.tsx frontend/src/routes/channels.index.tsx frontend/src/routes/notifications.tsx`
Expected: `1` для каждого файла.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/routes/feed.tsx frontend/src/routes/ads.index.tsx frontend/src/routes/my-ads.tsx frontend/src/routes/profile.tsx frontend/src/routes/friends.tsx frontend/src/routes/communities.index.tsx frontend/src/routes/channels.index.tsx frontend/src/routes/notifications.tsx
git commit -m "feat(layout): wire AppFooter into feed/ads/my-ads/profile/friends/communities/channels/notifications"
```

---

### Task 6: Лендинг — убрать Telegram, добавить соцсети

**Files:**
- Modify: `frontend/src/routes/index.tsx` (блок «Контакты», строки ~769-777)

**Interfaces:**
- Consumes: `SOCIAL_LINKS` из `@/lib/footer-links` (Task 1).
- Produces: нет новых экспортов.

**Контекст:** Текущий блок «Контакты» (точные строки, проверено перед
написанием плана):
```tsx
        {/* contacts */}
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Контакты</div>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm" style={{ color: "var(--foreground-50)" }}>
            <li><a href="mailto:support@modelizmclub.ru" style={{ color: "inherit" }}>support@modelizmclub.ru</a></li>
            <li><a href="tel:+78000000000" style={{ color: "inherit" }}>8 800 000-00-00</a></li>
            <li><a href="https://t.me/modelizm" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>Telegram: @modelizm</a></li>
            <li>Пн–Вс, 10:00–20:00 МСК</li>
          </ul>
        </div>
```

- [ ] **Step 1: Добавить импорт**

В `frontend/src/routes/index.tsx`, к существующему блоку импортов добавить:
```tsx
import { SOCIAL_LINKS } from "@/lib/footer-links";
```

- [ ] **Step 2: Убрать Telegram-строку, добавить соцсети**

Заменить:
```tsx
        {/* contacts */}
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Контакты</div>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm" style={{ color: "var(--foreground-50)" }}>
            <li><a href="mailto:support@modelizmclub.ru" style={{ color: "inherit" }}>support@modelizmclub.ru</a></li>
            <li><a href="tel:+78000000000" style={{ color: "inherit" }}>8 800 000-00-00</a></li>
            <li><a href="https://t.me/modelizm" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>Telegram: @modelizm</a></li>
            <li>Пн–Вс, 10:00–20:00 МСК</li>
          </ul>
        </div>
```
на:
```tsx
        {/* contacts */}
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Контакты</div>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm" style={{ color: "var(--foreground-50)" }}>
            <li><a href="mailto:support@modelizmclub.ru" style={{ color: "inherit" }}>support@modelizmclub.ru</a></li>
            <li><a href="tel:+78000000000" style={{ color: "inherit" }}>8 800 000-00-00</a></li>
            <li>Пн–Вс, 10:00–20:00 МСК</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {SOCIAL_LINKS.map((s) => (
              <span
                key={s.label}
                title="Скоро"
                className="inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[11px] font-semibold"
                style={{
                  background: "var(--background-surface)",
                  color: "var(--foreground-50)",
                  border: "1px solid var(--border)",
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
```

- [ ] **Step 3: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -in "telegram\|t\.me" frontend/src/routes/index.tsx`
Expected: пусто (ни одного упоминания).
Run: `grep -c "SOCIAL_LINKS" frontend/src/routes/index.tsx`
Expected: минимум `2` (импорт + использование).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "fix(landing): remove Telegram mention, add MAX/VK TODO chips to footer contacts"
```

---

## Notes для исполнителя

- Каждый таск заканчивается зелёным `npx tsc --noEmit` (из `frontend/`).
- Vitest/RTL не настроены — не писать/запускать unit-тесты; проверка = tsc + grep.
- Порядок: Task 1 (данные) должен быть первым — Task 3 и Task 6 импортируют из него. Task 3 перед Task 4 (AppFooter должен существовать для импорта). Task 4 перед Task 5 (проп должен существовать).
- Preview-QA (8 страниц, короткий/длинный контент, лендинг без Telegram, `/messenger` не задет) — работа контроллера после всех тасков, не в тасках.
- Не коммитить мерж в master/neeklo без явного разрешения оператора.
