# Landing Hero Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Увеличить логотип, убрать вводящий в заблуждение языковой переключатель с лендинга, починить hero-видео overlay (белая дымка при светлой теме) и убрать play/pause/mute controls с decorative-видео.

**Architecture:** Все правки в одном файле `src/routes/index.tsx` (плюс TODO-запись в `backend-endpoints-needed.md`). Четыре независимых точечных изменения: размер лого, удаление `LanguageSwitcher` из двух мест, фикс цвета overlay-градиента, удаление controls-блока с связанным state/функциями/иконками.

**Tech Stack:** React 18, TypeScript strict, TanStack Router, Tailwind, framer-motion, lucide-react.

## Global Constraints

- Работать строго внутри `frontend/`. Не трогать backend, video-хостинг, auth.
- Не трогать `LanguageSwitcher` компонент и переводческие словари (`ru/en/zh`) — используются корректно в App Shell.
- Не выдумывать функционал сверх спека (полный перевод лендинга — вне scope, фиксируется как TODO).
- CTA «Все объявления» уже ведёт на `/ads` в обоих местах — не трогать.
- Video-fail fallback (`videoError` → `<img src={cover}>`) должен продолжать работать без изменений в своей логике.
- TypeScript strict, без `any`. После изменений `npx tsc --noEmit` (из `frontend/`) чистый.
- Нет unit-тест-раннера — «тест» = `npx tsc --noEmit` + grep. Preview-QA (лого, отсутствие language switcher, overlay в обеих темах, отсутствие video controls, fallback-картинка) — работа контроллера после тасков, не в тасках.
- Не коммитить мерж без явного разрешения; коммиты по таскам разрешены.

---

### Task 1: Увеличить логотип + добавить TODO-запись

**Files:**
- Modify: `frontend/src/routes/index.tsx` (строка `~82`)
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:**
- Consumes: `Logo` из `@/components/Logo` (проп `size`, уже существует, компонент не меняется).
- Produces: нет новых экспортов.

**Контекст:** `Logo` уже адаптивно скейлит (`height`, `width:"auto"`, `maxWidth:"100%"` внутри `.logo-plate`) — менять сам компонент не нужно, только проп в вызове.

- [ ] **Step 1: Увеличить размер лого**

В `frontend/src/routes/index.tsx` заменить:
```tsx
<Logo size={28} />
```
на:
```tsx
<Logo size={40} />
```
(единственное вхождение в header-компоненте `TopNav`).

- [ ] **Step 2: Добавить TODO-запись в backend-endpoints-needed.md**

В конец `frontend/docs/backend-endpoints-needed.md` (текущая последняя секция — `## 7. Media → Listing цепочка (подтверждение)`) добавить:

```markdown

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
```

- [ ] **Step 3: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "Logo size={40}\|Logo size={28}" frontend/src/routes/index.tsx`
Expected: только `size={40}`, `size={28}` отсутствует.
Run: `grep -c "^## 8\." frontend/docs/backend-endpoints-needed.md`
Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/index.tsx frontend/docs/backend-endpoints-needed.md
git commit -m "feat(landing): enlarge header logo, log landing i18n TODO"
```

---

### Task 2: Убрать языковой переключатель с лендинга

**Files:**
- Modify: `frontend/src/routes/index.tsx`

**Interfaces:**
- Consumes: ничего нового.
- Produces: нет новых экспортов. `ThemeToggle` остаётся единственным контролом темы/языка в header.

**Контекст:** `LanguageSwitcher` используется в двух местах: desktop-строка контролов (`~104`) и mobile-шторка (`~156-159`, подпись «Тема и язык»). После удаления подпись в mobile-шторке должна остаться честной («Тема», не «Тема и язык»).

- [ ] **Step 1: Убрать из desktop-строки контролов**

Найти блок:
```tsx
          <div className="hidden items-center gap-1 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
```
заменить на:
```tsx
          <div className="hidden items-center gap-1 md:flex">
            <ThemeToggle />
          </div>
```

- [ ] **Step 2: Убрать из mobile-шторки + поправить подпись**

Найти блок:
```tsx
              <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--background-surface)" }}>
                <span className="text-sm" style={{ color: "var(--foreground-70)" }}>Тема и язык</span>
                <span className="flex items-center gap-1">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </span>
              </div>
```
заменить на:
```tsx
              <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--background-surface)" }}>
                <span className="text-sm" style={{ color: "var(--foreground-70)" }}>Тема</span>
                <span className="flex items-center gap-1">
                  <ThemeToggle />
                </span>
              </div>
```

- [ ] **Step 3: Убрать импорт**

Заменить:
```tsx
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
```
на:
```tsx
import { ThemeToggle } from "@/components/ThemeToggle";
```

- [ ] **Step 4: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок (если `LanguageSwitcher` использовался ещё где-то в файле помимо этих двух мест, tsc не покажет ошибку об этом — используй grep ниже, чтобы убедиться).
Run: `grep -n "LanguageSwitcher" frontend/src/routes/index.tsx`
Expected: пусто (ни импорта, ни использования).
Run: `grep -n "Тема и язык" frontend/src/routes/index.tsx`
Expected: пусто.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "fix(landing): remove misleading language switcher, keep theme toggle only"
```

---

### Task 3: Исправить hero-overlay градиент (белая дымка в светлой теме)

**Files:**
- Modify: `frontend/src/routes/index.tsx`

**Interfaces:**
- Consumes: ничего нового.
- Produces: нет новых экспортов.

**Контекст:** Overlay-градиент внутри `function Hero()` сейчас заканчивается на `var(--background)`, который в светлой теме — белый, из-за чего низ hero-видео "замывается" белым при переключении темы. Заменяется на фиксированный тёмный цвет, не зависящий от темы.

- [ ] **Step 1: Заменить градиент**

Найти блок:
```tsx
        {/* dark overlay — no white fade at the bottom, blends into --background */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(9,11,20,0.55) 0%, rgba(9,11,20,0.72) 55%, var(--background) 100%)" }}
        />
```
заменить на:
```tsx
        {/* dark overlay — fixed dark color at the bottom, independent of theme
            (var(--background) turned white in light theme and washed out the video) */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(9,11,20,0.55) 0%, rgba(9,11,20,0.72) 55%, rgba(9,11,20,0.92) 100%)" }}
        />
```

- [ ] **Step 2: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "rgba(9,11,20,0.92) 100%" frontend/src/routes/index.tsx`
Expected: одно совпадение.
Run: `grep -n "var(--background) 100%" frontend/src/routes/index.tsx`
Expected: пусто.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "fix(landing): hero overlay uses fixed dark color, not theme background"
```

---

### Task 4: Убрать play/pause/mute controls с decorative-видео

**Files:**
- Modify: `frontend/src/routes/index.tsx`

**Interfaces:**
- Consumes: ничего нового.
- Produces: нет новых экспортов. `<video>` остаётся `autoPlay muted loop playsInline` без ref/controls.

**Контекст:** `HeroCtrl` — приватная функция файла, используется только в этом controls-блоке (проверено — нет использований вне `index.tsx`). `videoRef`, `isPlaying`/`isMuted` state и `togglePlay`/`toggleMute` используются только этим блоком. Иконки `Play`, `Pause`, `Volume2`, `VolumeX` после удаления блока нигде в файле не используются.

- [ ] **Step 1: Убрать controls JSX-блок**

Найти блок (сразу после закрывающего `</div>` overlay-градиента, перед комментарием `{/* content */}`):
```tsx
      {/* video controls */}
      {!videoError && (
        <div className="absolute bottom-6 right-6 z-20 hidden gap-2 sm:flex">
          <HeroCtrl onClick={togglePlay} label={isPlaying ? "Пауза" : "Играть"}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </HeroCtrl>
          <HeroCtrl onClick={toggleMute} label={isMuted ? "Звук" : "Без звука"}>
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </HeroCtrl>
        </div>
      )}
```
удалить целиком (весь `{/* video controls */}` комментарий + условный блок).

- [ ] **Step 2: Убрать связанный state, функции, ref**

В начале `function Hero()` найти:
```tsx
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.pause();
    else void v.play().catch(() => {});
    setIsPlaying(!isPlaying);
  }
  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isMuted;
    setIsMuted(!isMuted);
  }
```
заменить на (сохранить `videoError` и `ready` — они нужны дальше в компоненте; убрать `videoRef`, `isPlaying`, `isMuted`, `togglePlay`, `toggleMute`):
```tsx
  const [videoError, setVideoError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);
```

- [ ] **Step 3: Убрать `ref={videoRef}` с тега `<video>`**

Найти:
```tsx
          <video
            ref={videoRef}
            poster={cover}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoError(true)}
            className="h-full w-full object-cover"
          >
```
заменить на:
```tsx
          <video
            poster={cover}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoError(true)}
            className="h-full w-full object-cover"
          >
```

- [ ] **Step 4: Убрать функцию `HeroCtrl`**

Удалить целиком:
```tsx
function HeroCtrl({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid place-items-center"
      style={{ width: 40, height: 40, borderRadius: "var(--r-pill)", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", backdropFilter: "blur(8px)" }}
    >{children}</button>
  );
}
```

- [ ] **Step 5: Убрать неиспользуемые иконки из импорта**

Заменить:
```tsx
import {
  ArrowRight, ChevronDown, Play, Pause, Volume2, VolumeX, Plus, Check,
  Newspaper, Megaphone, Users2, Radio, MessageSquare, Heart, MoreVertical,
  MapPin, Search, Compass, Sparkles, ImageOff, CalendarDays,
  Car, Plane, Ship, TrainFront, Cpu, Wrench, Package, Boxes,
} from "lucide-react";
```
на:
```tsx
import {
  ArrowRight, ChevronDown, Plus, Check,
  Newspaper, Megaphone, Users2, Radio, MessageSquare, Heart, MoreVertical,
  MapPin, Search, Compass, Sparkles, ImageOff, CalendarDays,
  Car, Plane, Ship, TrainFront, Cpu, Wrench, Package, Boxes,
} from "lucide-react";
```

- [ ] **Step 6: Убрать неиспользуемый `useRef` из импорта react**

`useRef` (строка 2, `import { useEffect, useRef, useState } from "react";`)
использовался только для `videoRef`, убранного в Step 2 — это единственное
использование в файле (проверено). Заменить:
```tsx
import { useEffect, useRef, useState } from "react";
```
на:
```tsx
import { useEffect, useState } from "react";
```

- [ ] **Step 7: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "HeroCtrl\|videoRef\|togglePlay\|toggleMute\|isPlaying\|isMuted" frontend/src/routes/index.tsx`
Expected: пусто.
Run: `grep -n "Play\b\|Pause\b\|Volume2\b\|VolumeX\b" frontend/src/routes/index.tsx`
Expected: пусто.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "fix(landing): remove play/pause/mute controls from decorative hero video"
```

---

## Notes для исполнителя

- Каждый таск заканчивается зелёным `npx tsc --noEmit` (из `frontend/`).
- Vitest/RTL не настроены — не писать/запускать unit-тесты; проверка = tsc + grep.
- Порядок тасков независим друг от друга (разные участки одного файла), но
  Task 4 удаляет `videoRef`/иконки — если исполняются не по порядку, свериться
  с actual состоянием файла перед правкой (использовать Read, не полагаться
  вслепую на номера строк из плана).
- Preview-QA (лого крупнее, нет language switcher, overlay тёмный в обеих
  темах, нет controls на видео, video-fail fallback работает) — работа
  контроллера после всех тасков, не часть самих тасков.
- Не коммитить мерж в master/neeklo без явного разрешения оператора.
