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

export const Route = createFileRoute("/settings/account")({
  component: AccountSection,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[6px] block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</span>
      {children}
    </label>
  );
}

function AccountSection() {
  const currentUser = useStore(selectors.currentUser);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [email, setEmail] = useState("");
  const [extra, setExtra] = useState<AccountExtra>(getAccountExtra);

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error("Новый пароль — минимум 8 символов"); return; }
    if (newPw !== confirmPw) { toast.error("Пароли не совпадают"); return; }
    toast("Смена пароля: будет доступно позже");
  };

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Введите корректный email"); return; }
    toast("Смена email: будет доступно позже");
  };

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

  return (
    <SettingsSectionShell title="Профиль и аккаунт">
      <Link
        to="/profile"
        className="flex items-center gap-[12px] rounded-[12px] border px-[16px] py-[14px] transition-colors hover:bg-[var(--background-surface)]"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium" style={{ color: "var(--foreground)" }}>Публичный профиль</div>
          <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>Аватар, обложка, имя, город, интересы</div>
        </div>
        <ChevronRight size={18} style={{ color: "var(--foreground-30)" }} />
      </Link>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена пароля</h2>
        <form onSubmit={submitPassword} className="space-y-[12px]">
          <Field label="Текущий пароль"><PasswordInput value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="Новый пароль"><PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Повторите новый пароль"><PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" /></Field>
          <Button type="submit" className="rounded-[10px]">Сменить пароль</Button>
        </form>
      </Card>

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
