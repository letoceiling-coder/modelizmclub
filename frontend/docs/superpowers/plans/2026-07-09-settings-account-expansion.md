# Settings Account Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `/settings/account` from password+email-change+profile-link into a grouped stack that also surfaces the real email address, an honest email-verification resend stub, and demo (localStorage) phone + social-link fields, plus an inert "Скоро" 2FA placeholder — per the coverage audit's A/B categories only.

**Architecture:** One type addition (`User.email`) threaded through `mapApiUser` and the demo user seed (A1). One new localStorage-backed helper (`AccountExtra`) added to the existing `settings-prefs.ts`, mirroring the `Requisites` pattern exactly. New cards appended to the existing `settings.account.tsx` — no new routes, no new files beyond the plan doc and doc updates.

**Tech Stack:** React 19, TypeScript strict, existing UI Kit (`Card`, `Button`, `Input`, `Badge`, and the existing `components/ui/phone-input.tsx` — reused, not reinvented). No new dependencies.

## Global Constraints

- Category C is explicitly out of scope: no card/payment-method binding form, no functional/interactive 2FA setup. The 2FA row is inert — no click handler, "Скоро" badge, reduced opacity.
- No fabricated "email verified ✓/✗" badge — the backend doesn't expose `email_verified` today, so none is shown. Only the real email address + a resend button + an honest "в разработке" note.
- Phone and social fields are `localStorage`-only (key `modelizm_account_extra`), same honest-note convention as the existing Реквизиты section ("Хранится локально. Интеграция — в разработке").
- No new `/settings/*` route — everything lands in the existing `settings.account.tsx`.
- Existing Password card and existing "Смена email" card are **unchanged** — do not alter their JSX or handlers.
- Reuse the existing `components/ui/phone-input.tsx` (`PhoneInput`, Russian mask, `defaultValue`/`onValueChange` API) for the phone field — do not build a new phone input.
- `npx tsc --noEmit` clean after every task.
- No unit-test framework — verification is `tsc` + live Playwright at 375px (mobile-first) then desktop.

---

### Task 1: Surface the real email — `User.email` + `mapApiUser` + demo seed

**Files:**
- Modify: `frontend/src/lib/mock.ts`
- Modify: `frontend/src/lib/api/auth.ts`
- Modify: `frontend/src/lib/demo-data.ts`

**Interfaces:**
- Produces: `User.email?: string` — consumed by Task 3's Email card via `useStore(selectors.currentUser)`.

- [ ] **Step 1: Add `email` to the `User` interface**

In `frontend/src/lib/mock.ts`, find the `User` interface (starts `export interface User {`, currently lines 6–23). Add `email?: string;` after the `avatar: string;` line:

```ts
export interface User {
  id: ID;
  numericId?: number;
  slug?: string;
  name: string;
  city: string;
  interests: string;
  avatar: string;
  email?: string;
  subscription?: "Тестовый" | "Месяц" | "Полгода" | "Год" | null;
  bio?: string;
  status?: string;
  coverImage?: string;
  joinedDate?: string;
  friendIds?: ID[];
  online?: boolean;
  isAdmin?: boolean;
  firstHundred?: boolean;
}
```

- [ ] **Step 2: Carry `email` through `mapApiUser`**

In `frontend/src/lib/api/auth.ts`, find `export function mapApiUser(u: ApiUser): User {` (currently ~line 29). Add `email: u.email ?? undefined,` to the returned object, right after `avatar: u.profile?.avatar?.url ?? avatarFallback(name),`:

```ts
export function mapApiUser(u: ApiUser): User {
  const name = u.profile?.display_name || u.name || u.email || "Пользователь";
  const interests = (u.interests ?? [])
    .map((i) => i?.name)
    .filter((n): n is string => Boolean(n))
    .join(", ");
  return {
    id: u.uuid,
    numericId: u.id ?? undefined,
    slug: u.profile?.slug ?? undefined,
    name,
    city: u.profile?.city?.name ?? "",
    interests,
    avatar: u.profile?.avatar?.url ?? avatarFallback(name),
    email: u.email ?? undefined,
    bio: u.profile?.bio ?? undefined,
    isAdmin: u.role === "admin",
  };
}
```

- [ ] **Step 3: Seed a demo email**

In `frontend/src/lib/demo-data.ts`, find `export const DEMO_USER: User = {` (currently ~line 46). Add `email: "alexey.krylov@modelizmclub.ru",` right after the `avatar: ...` block (after its closing line, before `subscription: "Год",`):

```ts
export const DEMO_USER: User = {
  id: "u1",
  numericId: 1,
  slug: "rcpilot",
  name: "Алексей Крылов",
  city: "Краснодар",
  interests: "RC авиация, Багги 1:8, Судомоделизм",
  avatar:
    "https://api.dicebear.com/7.x/initials/svg?seed=" +
    encodeURIComponent("Алексей Крылов") +
    "&backgroundColor=627fff,3f4fbf,1976d2",
  email: "alexey.krylov@modelizmclub.ru",
  subscription: "Год",
  bio: "Пилот RC-авиации и багги 1:8. Строю, летаю, гоняю. Собираю сообщество моделистов Краснодара.",
  status: "Основатель · МоДелизМ Pro",
  coverImage: "https://picsum.photos/seed/modelizm101/1200/400",
  joinedDate: "2024-03-15T10:00:00Z",
  friendIds: ["u2", "u3", "u5", "u6", "u7"],
  online: true,
  isAdmin: true,
  // ...rest of the object is unchanged, do not modify anything below this point
};
```

Only add the one `email:` line — do not touch any other field in `DEMO_USER`.

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
cd "/Users/neeklo/Documents/Project/САЙТЫ/MODELISM"
git add frontend/src/lib/mock.ts frontend/src/lib/api/auth.ts frontend/src/lib/demo-data.ts
git commit -m "feat(settings): surface real User.email (mapApiUser + demo seed)"
```

---

### Task 2: `AccountExtra` localStorage helper

**Files:**
- Modify: `frontend/src/lib/settings-prefs.ts`

**Interfaces:**
- Produces: `interface AccountExtra { phone: string; vk: string; telegram: string; website: string }`, `getAccountExtra(): AccountExtra`, `setAccountExtra(v: AccountExtra): void`. Consumed by Task 3.

- [ ] **Step 1: Append the helper**

At the end of `frontend/src/lib/settings-prefs.ts` (after the existing `setRequisites` function), append:

```ts

export interface AccountExtra {
  phone: string;
  vk: string;
  telegram: string;
  website: string;
}

const ACCOUNT_EXTRA_KEY = "modelizm_account_extra";
const ACCOUNT_EXTRA_DEFAULTS: AccountExtra = { phone: "", vk: "", telegram: "", website: "" };

export function getAccountExtra(): AccountExtra {
  if (typeof window === "undefined") return ACCOUNT_EXTRA_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(ACCOUNT_EXTRA_KEY);
    if (!raw) return ACCOUNT_EXTRA_DEFAULTS;
    return { ...ACCOUNT_EXTRA_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return ACCOUNT_EXTRA_DEFAULTS;
  }
}

export function setAccountExtra(v: AccountExtra): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNT_EXTRA_KEY, JSON.stringify(v));
}
```

This is byte-for-byte the same shape/pattern as the existing `Requisites`/`getRequisites`/`setRequisites` in the same file — do not deviate.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/neeklo/Documents/Project/САЙТЫ/MODELISM"
git add frontend/src/lib/settings-prefs.ts
git commit -m "feat(settings): add AccountExtra (phone/social links) localStorage helper"
```

---

### Task 3: Email/Phone/Соцсети/Безопасность cards in `settings.account.tsx`

**Files:**
- Modify: `frontend/src/routes/settings.account.tsx`

**Interfaces:**
- Consumes: `User.email` (Task 1) via `useStore(selectors.currentUser)`; `getAccountExtra`/`setAccountExtra`/`type AccountExtra` (Task 2); existing `PhoneInput` from `@/components/ui/phone-input`; existing `Badge` from `@/components/ui/badge`.

This task does NOT touch the existing "Публичный профиль" link, "Смена пароля" card, or "Смена email" card — it only adds new cards around them.

- [ ] **Step 1: Update imports**

At the top of `frontend/src/routes/settings.account.tsx`, replace the import block:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
```

with:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { useStore, selectors } from "@/lib/store";
import { getAccountExtra, setAccountExtra, type AccountExtra } from "@/lib/settings-prefs";
```

- [ ] **Step 2: Add state to `AccountSection`**

Find the start of `function AccountSection() {` and its existing state:

```tsx
function AccountSection() {
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [email, setEmail] = useState("");
```

Replace with (adds `currentUser` + `extra` state, keeps the four existing lines untouched):

```tsx
function AccountSection() {
  const currentUser = useStore(selectors.currentUser);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [email, setEmail] = useState("");
  const [extra, setExtra] = useState<AccountExtra>(getAccountExtra);
```

- [ ] **Step 3: Add handlers**

Right after the existing `submitEmail` function (before the `return (` statement), add:

```tsx
  const resendVerification = () => {
    toast("Письмо отправлено (демо)");
  };

  const savePhone = () => {
    setAccountExtra(extra);
    toast.success("Телефон сохранён");
  };

  const saveSocials = () => {
    setAccountExtra(extra);
    toast.success("Соцсети сохранены");
  };
```

- [ ] **Step 4: Insert the Email-status card**

Find the existing "Смена email" card:

```tsx
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена email</h2>
        <form onSubmit={submitEmail} className="space-y-[12px]">
          <Field label="Новый email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></Field>
          <Button type="submit" className="rounded-[10px]">Изменить email</Button>
        </form>
      </Card>
```

Insert a new card **immediately before it** (only if `currentUser?.email` is set):

```tsx
      {currentUser?.email && (
        <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
          <h2 className="mb-[6px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Email</h2>
          <p className="text-[14px]" style={{ color: "var(--foreground)" }}>{currentUser.email}</p>
          <Button type="button" variant="outline" size="sm" onClick={resendVerification} className="mt-[12px] rounded-[10px]">
            Отправить письмо повторно
          </Button>
          <p className="mt-[8px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            Реальная отправка и статус подтверждения — в разработке.
          </p>
        </Card>
      )}

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена email</h2>
        <form onSubmit={submitEmail} className="space-y-[12px]">
          <Field label="Новый email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></Field>
          <Button type="submit" className="rounded-[10px]">Изменить email</Button>
        </form>
      </Card>
```

- [ ] **Step 5: Append Phone, Соцсети, Безопасность cards**

Find the closing of the "Смена email" `<Card>` and the closing `</SettingsSectionShell>` tag:

```tsx
      </Card>
    </SettingsSectionShell>
  );
}
```

Replace with (adds three new cards after the "Смена email" card, before the shell closes):

```tsx
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Телефон</h2>
        <Field label="Номер телефона">
          <PhoneInput defaultValue={extra.phone} onValueChange={(v) => setExtra((e) => ({ ...e, phone: v }))} />
        </Field>
        <Button type="button" onClick={savePhone} className="mt-[12px] rounded-[10px]">Сохранить</Button>
        <p className="mt-[8px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Хранится локально. Интеграция с профилем — в разработке (см. backend-endpoints-needed.md #18).
        </p>
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Соцсети</h2>
        <div className="space-y-[12px]">
          <Field label="VK">
            <Input value={extra.vk} onChange={(e) => setExtra((x) => ({ ...x, vk: e.target.value }))} placeholder="https://vk.com/username" />
          </Field>
          <Field label="Telegram">
            <Input value={extra.telegram} onChange={(e) => setExtra((x) => ({ ...x, telegram: e.target.value }))} placeholder="https://t.me/username" />
          </Field>
          <Field label="Сайт">
            <Input value={extra.website} onChange={(e) => setExtra((x) => ({ ...x, website: e.target.value }))} placeholder="https://example.com" />
          </Field>
        </div>
        <Button type="button" onClick={saveSocials} className="mt-[12px] rounded-[10px]">Сохранить</Button>
        <p className="mt-[8px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Хранится локально. Интеграция с профилем — в разработке.
        </p>
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Безопасность</h2>
        <div
          className="flex items-center justify-between gap-[12px] rounded-[10px] px-[14px] py-[12px]"
          style={{ background: "var(--background-surface)", opacity: 0.6 }}
        >
          <span className="text-[14px]" style={{ color: "var(--foreground)" }}>Двухфакторная аутентификация</span>
          <Badge variant="draft" withIcon={false}>Скоро</Badge>
        </div>
      </Card>
    </SettingsSectionShell>
  );
}
```

Note: the Безопасность row has **no `onClick`** and no interactive element besides the static badge — it must stay genuinely inert per the Global Constraints.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Live verification — 375px FIRST, then desktop**

At `/settings/account`:
- Email card (only if demo user has an email — it does, from Task 1): shows `alexey.krylov@modelizmclub.ru`, no verified/unverified badge anywhere on the page; "Отправить письмо повторно" → toast "Письмо отправлено (демо)".
- Existing "Смена пароля" and "Смена email" cards behave exactly as before (regression check — same validation, same stub toasts).
- Телефон card: type a number (mask formats as `+7 (999) 999-99-99`), Save → "Телефон сохранён"; reload the page → phone value persists.
- Соцсети card: fill all three fields, Save → "Соцсети сохранены"; reload → all three persist.
- Безопасность card: "Двухфакторная аутентификация" row with a "Скоро" badge, visibly dimmed, clicking it does nothing (no toast, no navigation, no state change).
- "Публичный профиль →" still links to `/profile` (regression check).
- No new console errors.

- [ ] **Step 8: Commit**

```bash
cd "/Users/neeklo/Documents/Project/САЙТЫ/MODELISM"
git add frontend/src/routes/settings.account.tsx
git commit -m "feat(settings): account expansion — email status, phone, socials, 2FA placeholder"
```

---

### Task 4: Backend-track documentation (extends entry #24)

**Files:**
- Modify: `frontend/docs/backend-endpoints-needed.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Append subsections 24.9–24.12**

At the end of `frontend/docs/backend-endpoints-needed.md` (after the existing `### 24.8 Обложка профиля` subsection, which is currently the last content in the file), append:

```markdown

### 24.9 Email-подтверждение статуса + повторная отправка
`email_verified: boolean` on the user resource (`GET /users/me` / wherever the current user payload is returned).
`POST /account/resend-verification-email` → 202, no body. Rate-limited server-side (not a frontend concern).
- Auth: required.
- Frontend: `settings.account.tsx` Email card currently shows the real address (already returned by the backend, previously dropped by `mapApiUser` — now carried through) with a "Отправить письмо повторно" button that is a pure demo toast (`Письмо отправлено (демо)`). No verified/unverified status is rendered client-side today, specifically because no `email_verified` field exists to render honestly.

### 24.10 Телефон пользователя
See #18 for the full write-up (field missing from `RegisterRequest`/`UpdateProfileRequest`, `PhoneInput` component already built and ready). The `settings.account.tsx` Телефон card is a second, independent frontend touch-point for the same missing field — currently `localStorage` (`modelizm_account_extra`), not connected to any endpoint. Once #18 is resolved, this card should switch to reading/writing the real field via `updateOwnProfile`, same as the eventual `register.tsx` fix.

### 24.11 Соцсети пользователя
`vk_url`, `telegram_url`, `website_url` (all optional strings) on `PATCH /users/me` / the profile resource.
- Auth: required for writes; public-readable on `GET /users/{id}` if these should show on a public profile (product decision, not specified here).
- Frontend: `settings.account.tsx` Соцсети card, currently `localStorage` (`modelizm_account_extra`), no format validation beyond trim.

### 24.12 Двухфакторная аутентификация — не реализовано, только placeholder
`POST /account/2fa/setup` (returns a QR/secret), `POST /account/2fa/verify` (confirms a code), `POST /account/2fa/disable`.
- Frontend currently ships **only an inert UI placeholder** (a disabled row with a "Скоро" badge, no click handler) — deliberately not an interactive/functional setup flow, to avoid presenting protection that doesn't exist. No client-side 2FA logic exists to wire up; this would be new frontend work, not a connect-the-existing-UI task like the others in this entry.

### 24.13 Привязка способов оплаты — explicitly not simulated
No saved-payment-method / card-binding UI exists anywhere in the frontend, and none was added as part of the Настройки work. `components/PaymentModal.tsx` is an existing, unused, self-labelled prototype stub for one-shot checkout ("В production будет подключена оплата через ЮKassa или Т-Банк. Сейчас это заглушка для прототипа.") — it is not a saved-methods vault and has no importers. A real payment-method feature requires a PCI-scope decision (tokenized vault via a provider, most likely ЮKassa or Т-Банк per the existing stub's own note) that is out of scope for frontend-only work. No endpoint shape is proposed here since the provider integration approach isn't decided.
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/neeklo/Documents/Project/САЙТЫ/MODELISM"
git add frontend/docs/backend-endpoints-needed.md
git commit -m "docs(backend): entry #24 extension — email status, phone, socials, 2FA, payments"
```

---

### Task 5: Final QA (verification only)

**Files:** none.

**Interfaces:** none.

- [ ] **Step 1: Full typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 2: Mobile 375px end-to-end**

At `/settings/account`, 375×812:
- Card order top-to-bottom: Публичный профиль (link) → Email (status/resend) → Смена пароля → Смена email → Телефон → Соцсети → Безопасность.
- Email card shows the real address, no verified badge, resend toast works.
- Phone/Соцсети save + persist across reload.
- Безопасность row is inert (no click reaction) with "Скоро" badge.
- Password/change-email cards behave identically to before this plan (regression).

- [ ] **Step 3: Desktop end-to-end**

At 1440×900, same page: takeover layout from the prior fix still holds (single settings rail, no double-nav — regression check since this plan doesn't touch layout, but confirm nothing broke), all cards render correctly in the content pane.

- [ ] **Step 4: Regression + console**

- `/profile` still reachable via "Публичный профиль →" and unaffected.
- No new console errors on `/settings/account`.
- Other `/settings/*` sections (notifications, wallet, requisites, rating, history) untouched — spot-check one (e.g. `/settings/wallet`) still renders correctly.

- [ ] **Step 5: Report results**

Summarize what was checked and any findings. Verification-only — no commit for this task.
