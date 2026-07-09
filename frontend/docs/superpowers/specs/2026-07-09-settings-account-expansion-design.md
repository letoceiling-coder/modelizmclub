# Settings Account Expansion — Design Spec

## Context

The customer reviewed the shipped Настройки and felt `/settings/account` was thin — just password + email demo forms + a link to `/profile`. Before adding anything, an audit was run across the **whole project** (not just `/settings`) to find what account/security functionality already exists but isn't surfaced, versus what genuinely doesn't exist anywhere.

## Audit findings

| Capability | Status | Evidence |
|---|---|---|
| Email verification (signup) | **Real** | `/auth/verify-email`, `verifyEmail()` in `lib/api/auth.ts`, 6-digit code flow at `/verify-email` |
| Current user's email value | **Real backend data, dropped client-side** | `ApiUser.email` exists but `mapApiUser()` never copies it onto `User` |
| Password reset (logged out) | **Real** | `/recover`, `/reset-password` |
| Password change (in-settings) | Demo stub (already shipped) | `settings.account.tsx` |
| Payment/checkout | Unused, honest stub | `PaymentModal.tsx` — no importers, self-labelled "заглушка для прототипа" |
| Saved payment methods (cards) | **Does not exist** | No field, no component, nowhere |
| User social links (VK/Telegram/site) | **Does not exist** | `User` model has none; community `contacts` is a different, unrelated entity |
| User phone | **No backend field** | Already tracked as gap in `backend-endpoints-needed.md` #18 |
| 2FA | **Does not exist** | `input-otp.tsx` is OTP UI for password recovery only, not 2FA |
| OAuth / connected accounts / active sessions | **Does not exist** | — |

## Classification

- **(A) Exists, not surfaced — cheap to add:** A1. Display the real email address in `/settings/account` (one mapping fix).
- **(B) Absent — honest demo UI, explicitly labelled, backend-tracked:** B1 email-verification status/resend, B2 phone, B3 social links, B4 a **disabled** 2FA row.
- **(C) Explicitly excluded — not simulated at all:** C1 saved payment methods / card binding (would collect data that saves nowhere while looking like a real payment form — false sense of security). C2 a *functional-looking* 2FA setup (fake QR/secret that appears to arm protection it doesn't provide). Both are documented in the backend doc as future work, never built as interactive UI here.

## Goal

Expand `/settings/account` into a grouped stack of cards: Email (with verification status/resend), Password (unchanged), Phone, Соцсети, Безопасность (inert 2FA placeholder), and the existing "Публичный профиль →" link. No new routes — everything stays on the one page per the approved structure decision.

## Non-goals

- No card-binding / payment-method form (C1).
- No interactive/functional 2FA setup (C2) — the row is inert.
- No fabricated "email verified ✓" badge — the backend doesn't expose an `email_verified` flag today, so none is shown. Only a resend action + an honest note.
- No new `/settings/*` route — this is entirely inside the existing `settings.account.tsx`.
- Does not touch `/verify-email` (signup-time flow) — unrelated, already real, left as-is.

## Design

### 1. Email card (A1 + B1)

- Displays `currentUser.email` (real value, once A1's mapping fix lands). If empty (SSR/no-session edge case), the card is skipped gracefully — never renders a blank "email: " line.
- Below the address: "Отправить письмо повторно" button → `toast("Письмо отправлено (демо)")`, plus a small muted line: "Реальная отправка и статус подтверждения — в разработке." No verified/unverified badge is rendered — showing one without a real `email_verified` field would be a fabricated claim.

### 2. Password card — unchanged

Existing demo form (current/new/confirm, ≥8 chars, match check, toast stub). No changes.

### 3. Phone card (B2)

- Single field, prefilled from `localStorage`, `inputMode="tel"`, same placeholder style as the existing Реквизиты phone field.
- Save → writes to `localStorage` + `toast.success("Телефон сохранён")`.
- Muted note: "Хранится локально. Интеграция с профилем — в разработке (см. backend-endpoints-needed.md #18)."

### 4. Соцсети card (B3)

- Three fields: VK, Telegram, Сайт (all optional, no format validation beyond trim — matches the Реквизиты precedent of "no payment validation" extended to "no over-engineered format validation" for a demo field).
- Save → `localStorage` + `toast.success("Соцсети сохранены")`.
- Same "хранится локально" note style.

### 5. Безопасность card (B4)

- One row: "Двухфакторная аутентификация" + a "Скоро" `Badge`, row rendered with reduced opacity and no click handler (genuinely inert — not a button that does nothing silently, but visibly disabled so the user isn't left wondering why a click did nothing).
- No toggle, no setup flow, no QR code, no secret. This is intentionally the only card in the page with zero interactivity.

### 6. Публичный профиль → link — unchanged

## Data & types

Extend `frontend/src/lib/settings-prefs.ts` (mirrors the existing `Requisites` helper exactly — same file, same pattern, one new key):

```ts
export interface AccountExtra {
  phone: string;
  vk: string;
  telegram: string;
  website: string;
}
const ACCOUNT_EXTRA_KEY = "modelizm_account_extra";
const ACCOUNT_EXTRA_DEFAULTS: AccountExtra = { phone: "", vk: "", telegram: "", website: "" };
export function getAccountExtra(): AccountExtra { /* same read/merge/try-catch pattern as getRequisites */ }
export function setAccountExtra(v: AccountExtra): void { /* same write pattern as setRequisites */ }
```

`User` type (`lib/mock.ts`) gains `email?: string`. `mapApiUser()` (`lib/api/auth.ts`) adds `email: u.email ?? undefined,`. The demo current-user seed (wherever the demo `currentUser` is constructed — implementer locates it) gets a demo email value so the card isn't blank when `isDemoMode()`.

## Backend-track additions (extends entry #24, does not create a new numbered entry — same feature area)

- `email_verified: boolean` field on the user resource + `POST /account/resend-verification-email`.
- User `phone` field (cross-reference existing #18, don't duplicate the write-up — link to it).
- User social-link fields: `vk_url`, `telegram_url`, `website_url` on `PATCH /users/me`.
- 2FA: `POST /account/2fa/setup`, `POST /account/2fa/verify`, `POST /account/2fa/disable` — documented as a future capability, explicitly noting the frontend currently ships only an inert placeholder (no client work exists to wire up).
- Saved payment methods: explicitly documented as **not simulated client-side** — a real payment-method vault (tokenized card storage, PCI-scope integration with a provider like ЮKassa/Т-Банк, matching `PaymentModal.tsx`'s existing "заглушка" note) is a backend/infra decision, not a frontend stub; listed here only as a known gap, no endpoint shape speculated since the provider choice isn't made yet.

## Testing

No unit-test framework — `tsc --noEmit` + live Playwright at 375px (mobile-first) then desktop, per project convention.

- Email card shows the real `currentUser.email` (demo mode: seeded demo value); resend button shows the demo toast; no verified/unverified badge anywhere.
- Password card behavior unchanged (regression check only).
- Phone: save + reload persists via `modelizm_account_extra`.
- Соцсети: same save/reload persistence, all three fields independently.
- Безопасность row: visually disabled, no click handler, "Скоро" badge present.
- "Публичный профиль →" still links to `/profile` (regression check).
- No new console errors.
