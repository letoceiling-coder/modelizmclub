# Auth Page Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать `register.tsx`/`login.tsx` собственный сбалансированный левый контент в `AuthShell` (icon-based преимущества вместо несуществующей 3D-иллюстрации), увеличить типографику заголовков, перевести формы на shared `Input`/`Button`.

**Architecture:** `AuthShell` получает опциональный проп `leftContent?: ReactNode` с fallback на вынесенный `DefaultLeftContent` (нулевой diff для 3 нетронутых страниц). `register.tsx`/`login.tsx` строят свой `leftContent` и переводят формы на shared UI Kit.

**Tech Stack:** React 18, TypeScript strict, TanStack Router, lucide-react, shared UI Kit (`@/components/ui/input`, `@/components/ui/button`).

## Global Constraints

- Работать строго внутри `frontend/`. Не трогать auth-логику, submit-обработку, backend, routes.
- `recover.tsx`, `reset-password.tsx`, `verify-email.tsx` — визуально идентичны текущему состоянию (не передают `leftContent`).
- Никакого нового bespoke-стиля в формах — только shared `Input`/`Button` + существующие CSS-токены.
- 3D-иллюстрации нет в проекте — не создавать/не подключать новые ассеты; icon-based преимущества на lucide-иконках.
- `Card` не используется (обёртка поверх `AuthShell`-контейнера избыточна).
- TypeScript strict, без `any`. После изменений `npx tsc --noEmit` (из `frontend/`) чистый.
- Нет unit-тест-раннера — «тест» = `npx tsc --noEmit` + grep. Preview-QA (1440/1920 до/после, mobile, states полей, 3 нетронутые страницы) — работа контроллера после тасков.
- Не коммитить мерж без явного разрешения; коммиты по таскам разрешены.

---

### Task 1: `AuthShell` — проп `leftContent` + типографика заголовка

**Files:**
- Modify: `frontend/src/components/auth/AuthShell.tsx`

**Interfaces:**
- Produces: `Props.leftContent?: ReactNode`. Если не передан — рендерится `DefaultLeftContent()` (текущий блок без изменений). `register.tsx`/`login.tsx` (Task 2, 3) передают свой `leftContent`.

**Контекст:** Текущий файл (полностью, для точных before/after):
```tsx
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import cover from "@/assets/cover-modelizm.jpg";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div
      className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      {/* LEFT — visual */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(200,16,46,0.85) 0%, rgba(15,15,20,0.92) 70%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-[40px]" style={{ color: "#fff" }}>
          <Logo size={40} />
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-xs)",
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
              }}
            >
              МоДелизМ · v2.1
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                marginTop: 16,
                maxWidth: 460,
              }}
            >
              Сообщество моделистов
            </h2>
            <p style={{ color: "rgba(255,255,255,0.75)", marginTop: 16, maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
              Сборки, обсуждения, объявления и тематические чаты — для тех, для кого моделизм это жизнь.
            </p>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "rgba(255,255,255,0.4)" }}>
            «Моделизм — это жизнь, остальное детали»
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="relative flex flex-col">
        <div className="flex items-center justify-between px-[24px] py-[20px] lg:hidden">
          <Link to="/"><Logo /></Link>
          <ThemeToggle />
        </div>
        <div className="hidden justify-end p-[24px] lg:flex">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 flex-col justify-center px-[24px] pb-[40px] sm:px-[48px]">
          <div className="mx-auto w-full" style={{ maxWidth: 400 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h1>
            {subtitle && (
              <p style={{ color: "var(--foreground-70)", marginTop: 8, fontSize: "var(--fs-sm)" }}>{subtitle}</p>
            )}
            <div className="mt-[32px]">{children}</div>
            {footer && (
              <div className="mt-[24px]" style={{ fontSize: "var(--fs-sm)", color: "var(--foreground-70)" }}>
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "12px 14px",
  fontSize: "var(--fs-sm)",
  color: "var(--foreground)",
  outline: "none",
};

export const primaryBtn: React.CSSProperties = {
  width: "100%",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: "var(--fs-sm)",
  padding: "12px 16px",
  borderRadius: "var(--r-button)",
  border: "none",
  cursor: "pointer",
  boxShadow: "var(--shadow-button)",
};
```

- [ ] **Step 1: Добавить `leftContent` в Props и вынести DefaultLeftContent**

Заменить:
```tsx
interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: Props) {
```
на:
```tsx
interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Custom left-column content (register/login). Falls back to the brand
   *  block below when omitted — keeps recover/reset-password/verify-email
   *  visually unchanged. */
  leftContent?: ReactNode;
}

function DefaultLeftContent() {
  return (
    <>
      <Logo size={40} />
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-xs)",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.7)",
            textTransform: "uppercase",
          }}
        >
          МоДелизМ · v2.1
        </div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            marginTop: 16,
            maxWidth: 460,
          }}
        >
          Сообщество моделистов
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", marginTop: 16, maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
          Сборки, обсуждения, объявления и тематические чаты — для тех, для кого моделизм это жизнь.
        </p>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "rgba(255,255,255,0.4)" }}>
        «Моделизм — это жизнь, остальное детали»
      </div>
    </>
  );
}

export function AuthShell({ title, subtitle, children, footer, leftContent }: Props) {
```

- [ ] **Step 2: Использовать leftContent в разметке левой колонки**

Заменить:
```tsx
        <div className="relative flex h-full flex-col justify-between p-[40px]" style={{ color: "#fff" }}>
          <Logo size={40} />
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-xs)",
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
              }}
            >
              МоДелизМ · v2.1
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                marginTop: 16,
                maxWidth: 460,
              }}
            >
              Сообщество моделистов
            </h2>
            <p style={{ color: "rgba(255,255,255,0.75)", marginTop: 16, maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
              Сборки, обсуждения, объявления и тематические чаты — для тех, для кого моделизм это жизнь.
            </p>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "rgba(255,255,255,0.4)" }}>
            «Моделизм — это жизнь, остальное детали»
          </div>
        </div>
```
на:
```tsx
        <div className="relative flex h-full flex-col justify-between p-[40px]" style={{ color: "#fff" }}>
          {leftContent ?? <DefaultLeftContent />}
        </div>
```

- [ ] **Step 3: Увеличить заголовок формы с воздухом (общая правка, все 5 страниц)**

Заменить:
```tsx
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h1>
            {subtitle && (
              <p style={{ color: "var(--foreground-70)", marginTop: 8, fontSize: "var(--fs-sm)" }}>{subtitle}</p>
            )}
```
на:
```tsx
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{title}</h1>
            {subtitle && (
              <p style={{ color: "var(--foreground-70)", marginTop: 10, fontSize: "var(--fs-sm)" }}>{subtitle}</p>
            )}
```

- [ ] **Step 4: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "leftContent\|DefaultLeftContent" frontend/src/components/auth/AuthShell.tsx`
Expected: 4 совпадения (Props, DefaultLeftContent определение, использование в AuthShell сигнатуре, использование в JSX `{leftContent ?? <DefaultLeftContent />}`).
Run: `grep -n "fontSize: 38" frontend/src/components/auth/AuthShell.tsx`
Expected: одно совпадение.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/AuthShell.tsx
git commit -m "feat(auth): AuthShell accepts optional leftContent, roomier form title"
```

---

### Task 2: `register.tsx` — icon-benefits leftContent + shared Input/Button

**Files:**
- Modify: `frontend/src/routes/register.tsx`

**Interfaces:**
- Consumes: `AuthShell` c `leftContent` (Task 1), `Input`/`Button` из `@/components/ui/input` и `@/components/ui/button`.
- Produces: нет новых экспортов.

**Контекст:** Текущий `register.tsx` (полностью, для точных before/after) — см.
раздел "Найденное в коде" спека `2026-07-05-auth-page-layout-design.md`.
Существующая проверка `if (password !== passwordConfirmation)` уже вызывает
`toast.error("Пароли не совпадают")` — добавляем локальный `fieldError`
boolean, выставляемый в том же месте, использующийся для подсветки
password-полей через `Input error`.

- [ ] **Step 1: Обновить импорты**

Заменить:
```tsx
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
```
на:
```tsx
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Megaphone, Users2, UserCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
```

- [ ] **Step 2: Добавить fieldError state**

Заменить:
```tsx
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
```
на:
```tsx
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState(false);
```

- [ ] **Step 3: Выставлять/сбрасывать fieldError в submit**

Заменить:
```tsx
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agree) return toast.error("Подтвердите согласие с правилами");
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("password_confirmation") ?? "");
    if (password !== passwordConfirmation) {
      return toast.error("Пароли не совпадают");
    }
    setLoading(true);
    try {
      await register({ name, email, password, passwordConfirmation, referralCode: ref });
      toast.success("Аккаунт создан. Введите код из письма");
      nav({ to: "/verify-email", search: { email } });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.errors
            ? Object.values(err.errors)[0]?.[0] ?? err.message
            : err.message
          : "Не удалось зарегистрироваться. Попробуйте позже";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
```
на:
```tsx
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError(false);
    if (!agree) return toast.error("Подтвердите согласие с правилами");
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("password_confirmation") ?? "");
    if (password !== passwordConfirmation) {
      setFieldError(true);
      return toast.error("Пароли не совпадают");
    }
    setLoading(true);
    try {
      await register({ name, email, password, passwordConfirmation, referralCode: ref });
      toast.success("Аккаунт создан. Введите код из письма");
      nav({ to: "/verify-email", search: { email } });
    } catch (err) {
      setFieldError(true);
      const msg =
        err instanceof ApiError
          ? err.errors
            ? Object.values(err.errors)[0]?.[0] ?? err.message
            : err.message
          : "Не удалось зарегистрироваться. Попробуйте позже";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 4: Определить leftContent перед return**

Добавить сразу перед `return (`:
```tsx
  const leftContent = (
    <>
      <Logo size={40} />
      <div className="flex flex-col gap-[20px]">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            maxWidth: 460,
          }}
        >
          Присоединяйтесь к сообществу моделистов
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
          Создайте аккаунт за минуту — и получите доступ к каталогу
          объявлений, тематическим сообществам и личному профилю моделиста.
        </p>
        <div className="flex flex-col gap-[14px]">
          {[
            { icon: Megaphone, text: "Объявления без комиссии" },
            { icon: Users2, text: "Сообщества по интересам" },
            { icon: UserCircle, text: "Личный профиль моделиста" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-[12px]">
              <div
                className="grid shrink-0 place-items-center rounded-full"
                style={{ width: 36, height: 36, background: "var(--accent)", color: "#fff" }}
              >
                <Icon size={18} />
              </div>
              <span style={{ fontSize: "var(--fs-sm)", color: "rgba(255,255,255,0.9)" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "rgba(255,255,255,0.4)" }}>
        «Моделизм — это жизнь, остальное детали»
      </div>
    </>
  );

```

- [ ] **Step 5: Передать leftContent в AuthShell**

Заменить:
```tsx
    <AuthShell
      title="Создать аккаунт"
      subtitle="Несколько секунд — и вы внутри сообщества"
      footer={
```
на:
```tsx
    <AuthShell
      title="Создать аккаунт"
      subtitle="Несколько секунд — и вы внутри сообщества"
      leftContent={leftContent}
      footer={
```

- [ ] **Step 6: Заменить input/button на shared Input/Button**

Заменить:
```tsx
      <form onSubmit={submit} className="space-y-[12px]">
        <input required name="name" placeholder="Имя и фамилия" style={inputStyle} />
        <input required name="email" type="email" placeholder="Email" style={inputStyle} />
        <input required name="password" type="password" placeholder="Пароль (от 8 символов)" minLength={8} style={inputStyle} />
        <input required name="password_confirmation" type="password" placeholder="Повторите пароль" minLength={8} style={inputStyle} />
        <label className="flex items-start gap-[10px]" style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-70)", marginTop: 8 }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--accent)" }} />
          <span>
            Я принимаю{" "}
            <Link to="/legal/rules" style={{ color: "var(--accent)" }}>правила сообщества</Link> и{" "}
            <Link to="/legal/privacy" style={{ color: "var(--accent)" }}>политику</Link> обработки данных
          </span>
        </label>
        <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 16, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Создаём…" : "Создать аккаунт"}
        </button>
      </form>
```
на:
```tsx
      <form onSubmit={submit} className="space-y-[12px]">
        <Input required name="name" placeholder="Имя и фамилия" />
        <Input required name="email" type="email" placeholder="Email" />
        <Input required name="password" type="password" placeholder="Пароль (от 8 символов)" minLength={8} error={fieldError} />
        <Input required name="password_confirmation" type="password" placeholder="Повторите пароль" minLength={8} error={fieldError} />
        <label className="flex items-start gap-[10px]" style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-70)", marginTop: 8 }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--accent)" }} />
          <span>
            Я принимаю{" "}
            <Link to="/legal/rules" style={{ color: "var(--accent)" }}>правила сообщества</Link> и{" "}
            <Link to="/legal/privacy" style={{ color: "var(--accent)" }}>политику</Link> обработки данных
          </span>
        </label>
        <Button type="submit" disabled={loading} className="w-full" style={{ marginTop: 16 }}>
          {loading ? "Создаём…" : "Создать аккаунт"}
        </Button>
      </form>
```

- [ ] **Step 7: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок (`ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`, `style` — валидный проп).
Run: `grep -n "inputStyle\|primaryBtn" frontend/src/routes/register.tsx`
Expected: пусто (больше не импортируются/используются).
Run: `grep -n "leftContent" frontend/src/routes/register.tsx`
Expected: минимум 2 совпадения (определение + передача в AuthShell).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/routes/register.tsx
git commit -m "feat(auth): register page gets benefits leftContent, shared Input/Button"
```

---

### Task 3: `login.tsx` — лаконичный leftContent + shared Input/Button

**Files:**
- Modify: `frontend/src/routes/login.tsx`

**Interfaces:**
- Consumes: `AuthShell` c `leftContent` (Task 1), `Input`/`Button`.
- Produces: нет новых экспортов.

**Контекст:** Текущий `login.tsx` (полностью) — см. "Найденное в коде" в
спеке. Существующий `catch` уже вызывает `toast.error(msg)` при 401/422 —
добавляем `fieldError` boolean по тому же принципу, что в Task 2.

- [ ] **Step 1: Обновить импорты**

Заменить:
```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { login } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { resetSessionCache } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/client";
```
на:
```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { login } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { resetSessionCache } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/client";
```

- [ ] **Step 2: Добавить fieldError state**

Заменить:
```tsx
  const { redirect: redirectTo } = Route.useSearch();
  const [loading, setLoading] = useState(false);
```
на:
```tsx
  const { redirect: redirectTo } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState(false);
```

- [ ] **Step 3: Выставлять/сбрасывать fieldError в submit**

Заменить:
```tsx
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setLoading(true);
    try {
      const user = await login(email, password);
      resetSessionCache();
      setCurrentUser(user);
      toast.success("Вход выполнен");
      const target = redirectTo?.startsWith("/") ? redirectTo : "/feed";
      nav({ to: target as "/feed" });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 401 || err.status === 422
            ? "Неверный email или пароль"
            : err.message
          : "Не удалось войти. Попробуйте позже";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
```
на:
```tsx
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError(false);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setLoading(true);
    try {
      const user = await login(email, password);
      resetSessionCache();
      setCurrentUser(user);
      toast.success("Вход выполнен");
      const target = redirectTo?.startsWith("/") ? redirectTo : "/feed";
      nav({ to: target as "/feed" });
    } catch (err) {
      setFieldError(true);
      const msg =
        err instanceof ApiError
          ? err.status === 401 || err.status === 422
            ? "Неверный email или пароль"
            : err.message
          : "Не удалось войти. Попробуйте позже";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 4: Определить leftContent перед return**

Добавить сразу перед `return (`:
```tsx
  const leftContent = (
    <>
      <Logo size={40} />
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            maxWidth: 460,
          }}
        >
          С возвращением
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", marginTop: 16, maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
          Входите и продолжайте общаться с сообществом моделистов.
        </p>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "rgba(255,255,255,0.4)" }}>
        «Моделизм — это жизнь, остальное детали»
      </div>
    </>
  );

```

- [ ] **Step 5: Передать leftContent в AuthShell**

Заменить:
```tsx
    <AuthShell
      title="Вход"
      subtitle="С возвращением в МоДелизМ"
      footer={
```
на:
```tsx
    <AuthShell
      title="Вход"
      subtitle="С возвращением в МоДелизМ"
      leftContent={leftContent}
      footer={
```

- [ ] **Step 6: Заменить input/button на shared Input/Button**

Заменить:
```tsx
      <form onSubmit={submit} className="space-y-[12px]">
        <input required name="email" type="email" placeholder="Email или телефон" style={inputStyle} />
        <input required name="password" type="password" placeholder="Пароль" style={inputStyle} />
        <div className="flex items-center justify-between" style={{ fontSize: "var(--fs-xs)" }}>
          <label className="flex items-center gap-[8px]" style={{ color: "var(--foreground-70)" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} />
            Запомнить меня
          </label>
          <Link to="/recover" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Забыли пароль?
          </Link>
        </div>
        <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1, marginTop: 8 }}>
          {loading ? "Входим…" : "Войти"}
        </button>
      </form>
```
на:
```tsx
      <form onSubmit={submit} className="space-y-[12px]">
        <Input required name="email" type="email" placeholder="Email или телефон" error={fieldError} />
        <Input required name="password" type="password" placeholder="Пароль" error={fieldError} />
        <div className="flex items-center justify-between" style={{ fontSize: "var(--fs-xs)" }}>
          <label className="flex items-center gap-[8px]" style={{ color: "var(--foreground-70)" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} />
            Запомнить меня
          </label>
          <Link to="/recover" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Забыли пароль?
          </Link>
        </div>
        <Button type="submit" disabled={loading} className="w-full" style={{ marginTop: 8 }}>
          {loading ? "Входим…" : "Войти"}
        </Button>
      </form>
```

- [ ] **Step 7: Проверка tsc + grep**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.
Run: `grep -n "inputStyle\|primaryBtn" frontend/src/routes/login.tsx`
Expected: пусто.
Run: `grep -n "leftContent" frontend/src/routes/login.tsx`
Expected: минимум 2 совпадения.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/routes/login.tsx
git commit -m "feat(auth): login page gets concise leftContent, shared Input/Button"
```

---

## Notes для исполнителя

- Каждый таск заканчивается зелёным `npx tsc --noEmit` (из `frontend/`).
- Vitest/RTL не настроены — не писать/запускать unit-тесты; проверка = tsc + grep.
- Task 1 обязателен перед Task 2/3 (оба используют `leftContent`).
- Preview-QA (1440/1920 до/после, mobile, states, 3 нетронутые страницы) — работа контроллера после всех тасков, не в тасках.
- Не коммитить мерж в master/neeklo без явного разрешения оператора.
