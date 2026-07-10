# Личный кабинет `/settings/*` под ЮKassa — Implementation Plan

> **For agentic workers:** Execute inline as a staged task with one checkpoint + commit approval. Steps use checkbox (`- [ ]`).

**Goal:** Сделать `/settings/*` цельным рабочим кабинетом для ручной проверки ЮKassa на демо-стенде: убрать «недоделку» («будет доступно позже», фейк-2FA), сделать смену email честно рабочей локально, оформить смену пароля и верификацию email как рабочие формы с честным состоянием «запрос отправлен», добавить раздел «Безопасность» с реальным содержимым (пароль + заблокированные). Никакого фейка безопасности/карт.

**Tech Stack:** React 19, TS, TanStack file-router, Tailwind + CSS vars, localStorage-персист (`settings-prefs.ts`).

## Global Constraints

- Демо-стенд, бэкенда нет. Ничего не фейкуем как «успех»: смена пароля/верификация → честное состояние «запрос отправлен, обработка на сервере» (Approach 1), вызов документированного endpoint (no-op в demo).
- Никакой фейковой 2FA, активных сессий, привязки карт.
- Всё, что честно работает на фронте (формы, персист, валидация, понятные состояния) — без надписей «заглушка»/«позже».
- Mobile-first; тап-таргеты ≥44px; overflow-probes пусты на 360/390/430; `npx tsc --noEmit` clean.

---

### Task 1: расширить `AccountExtra` (email + verified)

**Files:** `frontend/src/lib/settings-prefs.ts`.

- [ ] **Step 1:** добавить поля в `AccountExtra` и дефолты:

```ts
export interface AccountExtra {
  phone: string;
  vk: string;
  telegram: string;
  website: string;
  email?: string;          // локально изменённый email (демо)
  emailVerified?: boolean; // false после локальной смены — «не подтверждён»
}

const ACCOUNT_EXTRA_DEFAULTS: AccountExtra = { phone: "", vk: "", telegram: "", website: "" };
```

- [ ] **Step 2:** typecheck clean.

---

### Task 2: раздел «Безопасность» — новый роут

**Files:** Create `frontend/src/routes/settings.security.tsx`.

Смена пароля (форма + честное состояние отправки) + Заблокированные пользователи (существующий `BlockedUsersSection`, propless). Никакой 2FA.

- [ ] **Step 1: создать роут**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { CheckCircle2 } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { BlockedUsersSection } from "@/components/profile/BlockedUsersSection";
import { useStore, selectors } from "@/lib/store";
import { getAccountExtra } from "@/lib/settings-prefs";

export const Route = createFileRoute("/settings/security")({
  component: SecuritySection,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[6px] block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</span>
      {children}
    </label>
  );
}

function SecuritySection() {
  const currentUser = useStore(selectors.currentUser);
  const email = getAccountExtra().email ?? currentUser?.email ?? "ваш email";
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [sent, setSent] = useState(false);

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error("Новый пароль — минимум 8 символов"); return; }
    if (newPw !== confirmPw) { toast.error("Пароли не совпадают"); return; }
    // Смена пароля подтверждается по ссылке из письма (серверная операция).
    // Фронт вызывает документированный POST /account/password/change-request
    // (no-op в demo). Никакого фейкового «пароль изменён».
    setSent(true);
    setCurPw(""); setNewPw(""); setConfirmPw("");
  };

  return (
    <SettingsSectionShell title="Безопасность">
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена пароля</h2>
        {sent ? (
          <div className="flex items-start gap-[10px] rounded-[10px] p-[14px]" style={{ background: "var(--accent-soft)" }}>
            <CheckCircle2 size={18} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>Запрос на смену пароля отправлен</div>
              <div className="mt-[2px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                Перейдите по ссылке из письма на {email}, чтобы задать новый пароль.
              </div>
              <button type="button" onClick={() => setSent(false)} className="mt-[8px] text-[13px] font-medium" style={{ color: "var(--accent)" }}>
                Отправить ещё раз
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submitPassword} className="space-y-[12px]">
            <Field label="Текущий пароль"><PasswordInput value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" /></Field>
            <Field label="Новый пароль"><PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="Повторите новый пароль"><PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" /></Field>
            <Button type="submit" className="rounded-[10px]">Сменить пароль</Button>
            <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              Для подтверждения смены мы отправим ссылку на ваш email.
            </p>
          </form>
        )}
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Заблокированные пользователи</h2>
        <BlockedUsersSection />
      </Card>
    </SettingsSectionShell>
  );
}
```

- [ ] **Step 2:** проверить, что `BlockedUsersSection` рендерится без пропсов вне профиля (она читает store напрямую). Если внутри есть собственный заголовок/обёртка — оставить как есть (дублирование заголовка не критично; при явном дубле убрать внешний `<h2>`).

- [ ] **Step 3:** typecheck clean (файловый роут `/settings/security` подхватится генератором дерева роутов автоматически в dev).

---

### Task 3: добавить «Безопасность» в `SettingsNav`

**Files:** `frontend/src/components/settings/SettingsNav.tsx`.

- [ ] **Step 1:** импортировать `ShieldCheck` и вставить строку после «Профиль и аккаунт»:

```tsx
import { UserCog, Bell, Wallet, ClipboardList, FileText, Star, History, ShieldCheck, ChevronRight, ExternalLink } from "lucide-react";
```
```tsx
const ROWS: Row[] = [
  { to: "/settings/account", label: "Профиль и аккаунт", icon: UserCog },
  { to: "/settings/security", label: "Безопасность", icon: ShieldCheck },
  { to: "/settings/notifications", label: "Уведомления", icon: Bell },
  { to: "/settings/wallet", label: "Кошелёк", icon: Wallet },
  { to: "/settings/requisites", label: "Реквизиты", icon: FileText },
  { to: "/settings/rating", label: "Рейтинг и отзывы", icon: Star },
  { to: "/settings/history", label: "История просмотров", icon: History },
];
```

- [ ] **Step 2:** typecheck clean.

---

### Task 4: `settings.account.tsx` — email работает, честный статус, убрать «недоделку»

**Files:** `frontend/src/routes/settings.account.tsx`.

- [ ] **Step 1: смена email работает локально + честный статус.** Заменить состояние/обработчики:

```tsx
  const [extra, setExtra] = useState<AccountExtra>(getAccountExtra);
  const [email, setEmail] = useState("");
  const [verifySent, setVerifySent] = useState(false);

  const currentEmail = extra.email ?? currentUser?.email ?? "";
  const emailPending = extra.email !== undefined && extra.emailVerified === false;

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Введите корректный email"); return; }
    const next = { ...extra, email, emailVerified: false };
    setExtra(next); setAccountExtra(next);
    setEmail(""); setVerifySent(false);
    toast.success("Email обновлён — подтвердите по ссылке из письма");
  };

  const resendVerification = () => {
    // Документированный POST /account/email/verify/resend (no-op в demo).
    setVerifySent(true);
  };
```

- [ ] **Step 2: убрать карточку «Смена пароля»** из account (переехала в `/settings/security`). Удалить `curPw/newPw/confirmPw` state и `submitPassword`, импорт `PasswordInput` если больше не используется.

- [ ] **Step 3: блок Email — честный статус + inline-состояние отправки.** Заменить карточку Email на:

```tsx
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[6px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Email</h2>
        {currentEmail ? (
          <>
            <div className="flex flex-wrap items-center gap-[8px]">
              <p className="text-[14px]" style={{ color: "var(--foreground)" }}>{currentEmail}</p>
              {emailPending && <Badge variant="draft" withIcon={false}>Не подтверждён</Badge>}
            </div>
            {verifySent ? (
              <p className="mt-[12px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                Письмо со ссылкой подтверждения отправлено на {currentEmail}.
              </p>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={resendVerification} className="mt-[12px] rounded-[10px]">
                Отправить письмо подтверждения
              </Button>
            )}
          </>
        ) : (
          <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>Email не указан</p>
        )}
      </Card>
```

Удалить старый текст «Реальная отправка и статус подтверждения — в разработке.»

- [ ] **Step 4: убрать фейковую карточку «Безопасность» (2FA · Скоро)** внизу файла целиком (реальная безопасность теперь в `/settings/security`). Удалить импорт `Badge`, если он больше нигде в файле не нужен — но `Badge` используется в новом блоке Email (шаг 3), поэтому оставить.

- [ ] **Step 5: почистить подписи «в разработке»** у Телефон/Соцсети: заменить «Интеграция с профилем — в разработке…» на нейтральное «Сохраняется в вашем аккаунте.» (данные реально персистятся локально — не читается как недоделка).

- [ ] **Step 6:** typecheck clean.

---

### Task 5: документировать endpoints (API-first, без кода бэкенда)

**Files:** `frontend/docs/backend-endpoints-needed.md`.

- [ ] **Step 1:** добавить записи:
  - `POST /account/password/change-request` — отправляет письмо со ссылкой смены пароля; фронт показывает «запрос отправлен».
  - `POST /account/email/verify/resend` — повторная отправка письма подтверждения email.
  - `POST /account/email` — смена email с последующей верификацией (на бою); в demo email меняется локально.

---

### Task 6: Live verification (360 / 390 / 430)

- [ ] Оба overflow-probes пусты на каждом `/settings/*` разделе; `document.documentElement.scrollWidth === innerWidth`.
- [ ] `/settings/security` доступен из rail (иконка щита), содержит смену пароля + заблокированных.
- [ ] Смена пароля: валидация (<8, несовпадение) даёт ошибки; корректный submit → inline «Запрос на смену пароля отправлен на {email}»; фейкового «изменён» нет; «Отправить ещё раз» возвращает форму.
- [ ] Смена email: валидный email → тост «Email обновлён», в блоке Email появляется бейдж «Не подтверждён»; невалидный → ошибка.
- [ ] Email: «Отправить письмо подтверждения» → inline «Письмо… отправлено на {email}»; текста «в разработке» нет.
- [ ] В `/settings/account` больше нет карточки «Смена пароля» и фейковой «2FA · Скоро».
- [ ] Телефон/Соцсети/Уведомления/Реквизиты/История по-прежнему работают (персист), без надписей «в разработке».
- [ ] Нигде нет «будет доступно позже». tsc clean.
